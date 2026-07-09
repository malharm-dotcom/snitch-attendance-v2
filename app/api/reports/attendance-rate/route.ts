import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, isSouth } from '@/lib/auth';
import { parseISTDate, formatAttendanceDate } from '@/lib/ist';
import { classifyStatus, normalizeFacility, SQL_NORM_FACILITY } from '@/lib/reporting';

export interface RateRow {
  date: string;
  facility: string;
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

    // Facility scope derived server-side from the session, never from params.
    const south = isSouth(session.facility);
    const scopeFacilities = south ? ['WH1', 'WH2'] : [normalizeFacility(session.facility)];
    const scopeLabel = south ? 'South (WH1 + WH2)' : scopeFacilities[0];
    const facList = scopeFacilities.map((f) => `'${f.replace(/'/g, "''")}'`).join(',');
    const normEmpFac = SQL_NORM_FACILITY('facility');
    const normHdrFac = SQL_NORM_FACILITY('h2.facility');

    // Eligible headcount per (date, facility): active employees, or exited on/after
    // that date, whose joining_date (if any) is on or before it. Calendar dates —
    // no timezone arithmetic anywhere.
    const eligibleRaw = await prisma.$queryRawUnsafe<{ d: Date; fac: string; eligible: number }[]>(`
      SELECT
        gs::date AS d,
        ${normEmpFac} AS fac,
        COUNT(DISTINCT employee_code)::int AS eligible
      FROM employees
      CROSS JOIN generate_series($1::date, $2::date, interval '1 day') gs
      WHERE (joining_date IS NULL OR joining_date <= gs::date)
        AND (exit_date IS NULL OR exit_date >= gs::date)
        AND (is_active OR (exit_date IS NOT NULL AND exit_date >= gs::date))
        AND ${normEmpFac} IN (${facList})
      GROUP BY 1, 2
    `, fromDate, toDate);

    // Marked statuses per (date, facility): one status per employee per day per
    // facility — latest submission wins (same dedup rule as the other reports).
    const markedRaw = await prisma.$queryRawUnsafe<{ d: Date; fac: string; status: string; cnt: number }[]>(`
      SELECT sub.attendance_date AS d, sub.fac, sub.attendance_status AS status,
             COUNT(DISTINCT sub.employee_code)::int AS cnt
      FROM (
        SELECT d2.employee_code, d2.attendance_date, ${normHdrFac} AS fac, d2.attendance_status,
               ROW_NUMBER() OVER (
                 PARTITION BY d2.employee_code, d2.attendance_date, ${normHdrFac}
                 ORDER BY h2.id DESC, d2.id DESC
               ) AS rn
        FROM attendance_detail d2
        JOIN attendance_header h2 ON d2.attendance_header_id = h2.id
        WHERE ${normHdrFac} IN (${facList})
          AND d2.attendance_date BETWEEN $1::date AND $2::date
      ) sub
      WHERE sub.rn = 1
      GROUP BY 1, 2, 3
    `, fromDate, toDate);

    const eligibleMap = new Map<string, number>();
    for (const r of eligibleRaw) eligibleMap.set(`${formatAttendanceDate(r.d)}|${r.fac}`, r.eligible);

    const markedMap = new Map<string, { marked: number; present: number; absent: number; unknown: string[] }>();
    for (const r of markedRaw) {
      const key = `${formatAttendanceDate(r.d)}|${r.fac}`;
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

    // Newest date first, facility ascending within a date.
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(fromDate.getTime() + i * 86400000);
      const dateStr = formatAttendanceDate(d);
      for (const fac of scopeFacilities) {
        const key = `${dateStr}|${fac}`;
        const eligible = eligibleMap.get(key) ?? 0;
        const m = markedMap.get(key) ?? { marked: 0, present: 0, absent: 0, unknown: [] };

        if (m.unknown.length > 0) {
          const w = `${dateStr} ${fac}: unbucketed attendance status(es): ${m.unknown.join(', ')}`;
          warnings.push(w);
          console.error(`[attendance-rate] ${w}`);
        }

        if (eligible === 0) {
          rows.push({ date: dateStr, facility: fac, eligible, marked: m.marked, presentLike: m.present, absentLike: m.absent, attendancePct: null, absenteeismPct: null, pendingPct: null });
          continue;
        }

        const attendancePct = round2((m.present / eligible) * 100);
        const absenteeismPct = round2((m.absent / eligible) * 100);
        const pendingPct = round2(((eligible - m.marked) / eligible) * 100);

        // Assertions — never clamp; surface violations loudly instead.
        const sum = attendancePct + absenteeismPct + pendingPct;
        if (Math.abs(sum - 100) > 0.05) {
          const w = `${dateStr} ${fac}: percentages sum to ${round2(sum)} (attendance=${attendancePct}, absenteeism=${absenteeismPct}, pending=${pendingPct})`;
          warnings.push(w);
          console.error(`[attendance-rate] ${w}`);
        }
        for (const [label, v] of [['Attendance', attendancePct], ['Absenteeism', absenteeismPct], ['Pending', pendingPct]] as const) {
          if (v < 0 || v > 100) {
            const w = `${dateStr} ${fac}: ${label}% out of range: ${v} (eligible=${eligible}, marked=${m.marked})`;
            warnings.push(w);
            console.error(`[attendance-rate] ${w}`);
          }
        }

        rows.push({ date: dateStr, facility: fac, eligible, marked: m.marked, presentLike: m.present, absentLike: m.absent, attendancePct, absenteeismPct, pendingPct });
      }
    }

    return NextResponse.json({ scope: scopeLabel, rows, warnings });
  } catch (error) {
    console.error('GET /api/reports/attendance-rate error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to generate attendance rate report' }, { status: 500 });
  }
}
