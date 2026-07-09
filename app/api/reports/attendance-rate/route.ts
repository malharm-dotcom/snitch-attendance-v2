import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, isSouth } from '@/lib/auth';
import { parseISTDate, formatAttendanceDate } from '@/lib/ist';
import { classifyStatus, normalizeFacility, normalizeDepartment, SQL_NORM_FACILITY } from '@/lib/reporting';

export interface RateRow {
  date: string;
  facility: string;
  /** present only when level = 'department' */
  department?: string;
  eligible: number;
  marked: number;
  presentLike: number;
  absentLike: number;
  /** null when eligible = 0 (rendered as em dash, never divide by zero) */
  attendancePct: number | null;
  absenteeismPct: number | null;
  pendingPct: number | null;
}

const MAX_RANGE_DAYS = 92;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: 'from and to are required (YYYY-MM-DD)' }, { status: 400 });
    }
    const fromDate = parseISTDate(from);
    const toDate = parseISTDate(to);
    if (fromDate > toDate) {
      return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 });
    }
    const rangeDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `Date range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 });
    }

    // Shift filter (optional). Whitelisted — never interpolate raw input.
    // Anchored to the employee's ROSTER shift (e.shift) so eligible and marked
    // describe the same population.
    const shiftParam = searchParams.get('shift') ?? '';
    const shift = shiftParam === 'Day' || shiftParam === 'Night' ? shiftParam : '';
    const shiftEmpClause = shift ? `AND LOWER(TRIM(e.shift)) = '${shift.toLowerCase()}'` : '';

    // Breakdown level: 'facility' (default) or 'department'.
    const level = searchParams.get('level') === 'department' ? 'department' : 'facility';
    const byDept = level === 'department';
    // Department expression: real ROSTER column when breaking down, else a constant so
    // the GROUP BY collapses to facility level and one code path serves both.
    const deptExprEmp = byDept ? `TRIM(e.department)` : `''::text`;

    // Facility scope derived server-side from the session, never from params.
    const south = isSouth(session.facility);
    const scopeFacilities = south ? ['WH1', 'WH2'] : [normalizeFacility(session.facility)];
    const scopeLabel = south ? 'South (WH1 + WH2)' : scopeFacilities[0];
    const facList = scopeFacilities.map((f) => `'${f.replace(/'/g, "''")}'`).join(',');
    const normEmpFac = SQL_NORM_FACILITY('e.facility');

    // Per-date roster eligibility predicate — reused by both queries so that the
    // marked population is always a subset of the eligible population (marked ≤
    // eligible ⇒ Pending% ≥ 0, and the three percentages sum to 100 by construction).
    const rosterPredicate = (dateExpr: string) => `
      (e.joining_date IS NULL OR e.joining_date <= ${dateExpr})
        AND (e.exit_date IS NULL OR e.exit_date >= ${dateExpr})
        AND (e.is_active OR (e.exit_date IS NOT NULL AND e.exit_date >= ${dateExpr}))
        AND ${normEmpFac} IN (${facList})
        ${shiftEmpClause}`;

    // Eligible headcount per (date, facility[, dept]) from the roster. Calendar
    // dates — no timezone arithmetic anywhere.
    const eligibleRaw = await prisma.$queryRawUnsafe<{ d: Date; fac: string; dept: string; eligible: number }[]>(`
      SELECT
        gs::date AS d,
        ${normEmpFac} AS fac,
        ${deptExprEmp} AS dept,
        COUNT(DISTINCT e.employee_code)::int AS eligible
      FROM employees e
      CROSS JOIN generate_series($1::date, $2::date, interval '1 day') gs
      WHERE ${rosterPredicate('gs::date')}
      GROUP BY 1, 2, 3
    `, fromDate, toDate);

    // Marked statuses per (date, facility[, dept]): each eligible employee's latest
    // status for that date, grouped by their ROSTER facility/department (not the
    // header's), so marked is always a subset of eligible.
    const markedRaw = await prisma.$queryRawUnsafe<{ d: Date; fac: string; dept: string; status: string; cnt: number }[]>(`
      SELECT sub.d, sub.fac, sub.dept, sub.status, COUNT(DISTINCT sub.employee_code)::int AS cnt
      FROM (
        SELECT d2.employee_code,
               d2.attendance_date AS d,
               ${normEmpFac} AS fac,
               ${deptExprEmp} AS dept,
               d2.attendance_status AS status,
               ROW_NUMBER() OVER (
                 PARTITION BY d2.employee_code, d2.attendance_date
                 ORDER BY h2.id DESC, d2.id DESC
               ) AS rn
        FROM attendance_detail d2
        JOIN attendance_header h2 ON d2.attendance_header_id = h2.id
        JOIN employees e ON e.employee_code = d2.employee_code
        WHERE d2.attendance_date BETWEEN $1::date AND $2::date
          AND ${rosterPredicate('d2.attendance_date')}
      ) sub
      WHERE sub.rn = 1
      GROUP BY 1, 2, 3, 4
    `, fromDate, toDate);

    // Normalize department spelling variants at read time (facility level: dept is '').
    const nd = (dept: string) => (byDept ? normalizeDepartment(dept) : dept);

    // Sum across raw-spelling groups that collapse to the same normalized department.
    // Each employee_code belongs to exactly one raw group, so summing preserves the
    // distinct-employee count.
    const eligibleMap = new Map<string, number>();
    for (const r of eligibleRaw) {
      const key = `${formatAttendanceDate(r.d)}|${r.fac}|${nd(r.dept)}`;
      eligibleMap.set(key, (eligibleMap.get(key) ?? 0) + r.eligible);
    }

    const markedMap = new Map<string, { marked: number; present: number; absent: number; unknown: string[] }>();
    for (const r of markedRaw) {
      const key = `${formatAttendanceDate(r.d)}|${r.fac}|${nd(r.dept)}`;
      if (!markedMap.has(key)) markedMap.set(key, { marked: 0, present: 0, absent: 0, unknown: [] });
      const m = markedMap.get(key)!;
      m.marked += r.cnt;
      const bucket = classifyStatus(r.status);
      if (bucket === 'present') m.present += r.cnt;
      else if (bucket === 'absent') m.absent += r.cnt;
      else m.unknown.push(r.status);
    }

    const warnings: string[] = [];
    const rows: RateRow[] = [];

    // Group keys (facility[, dept]) seen anywhere in the range, from either source.
    const groupKeys = new Set<string>();
    for (const k of eligibleMap.keys()) groupKeys.add(k.split('|').slice(1).join('|'));
    for (const k of markedMap.keys()) groupKeys.add(k.split('|').slice(1).join('|'));
    const sortedGroups = Array.from(groupKeys).sort((a, b) => a.localeCompare(b)); // "fac|dept"

    // Newest date first; facility then department ascending within a date.
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(fromDate.getTime() + i * 86400000);
      const dateStr = formatAttendanceDate(d);
      for (const g of sortedGroups) {
        const [fac, dept] = g.split('|');
        const key = `${dateStr}|${g}`;
        const eligible = eligibleMap.get(key) ?? 0;
        const m = markedMap.get(key) ?? { marked: 0, present: 0, absent: 0, unknown: [] };

        // Skip empty (date, group) cells so department view isn't a wall of dashes.
        if (eligible === 0 && m.marked === 0) continue;

        const who = byDept ? `${fac}/${dept}` : fac;

        if (m.unknown.length > 0) {
          const w = `${dateStr} ${who}: unbucketed attendance status(es): ${m.unknown.join(', ')}`;
          warnings.push(w);
          console.error(`[attendance-rate] ${w}`);
        }

        const base: RateRow = {
          date: dateStr,
          facility: fac,
          ...(byDept ? { department: dept || '(none)' } : {}),
          eligible,
          marked: m.marked,
          presentLike: m.present,
          absentLike: m.absent,
          attendancePct: null,
          absenteeismPct: null,
          pendingPct: null,
        };

        if (eligible === 0) {
          rows.push(base);
          continue;
        }

        const attendancePct = round2((m.present / eligible) * 100);
        const absenteeismPct = round2((m.absent / eligible) * 100);
        const pendingPct = round2(((eligible - m.marked) / eligible) * 100);

        // Assertions — never clamp; surface violations loudly instead.
        const sum = attendancePct + absenteeismPct + pendingPct;
        if (Math.abs(sum - 100) > 0.05) {
          const w = `${dateStr} ${who}: percentages sum to ${round2(sum)} (attendance=${attendancePct}, absenteeism=${absenteeismPct}, pending=${pendingPct})`;
          warnings.push(w);
          console.error(`[attendance-rate] ${w}`);
        }
        for (const [lab, v] of [['Attendance', attendancePct], ['Absenteeism', absenteeismPct], ['Pending', pendingPct]] as const) {
          if (v < 0 || v > 100) {
            const w = `${dateStr} ${who}: ${lab}% out of range: ${v} (eligible=${eligible}, marked=${m.marked})`;
            warnings.push(w);
            console.error(`[attendance-rate] ${w}`);
          }
        }

        rows.push({ ...base, attendancePct, absenteeismPct, pendingPct });
      }
    }

    return NextResponse.json({ scope: scopeLabel, level, shift: shift || 'All', rows, warnings });
  } catch (error) {
    console.error('GET /api/reports/attendance-rate error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to generate attendance rate report' }, { status: 500 });
  }
}
