import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, isSouth } from '@/lib/auth';
import { parseISTDate } from '@/lib/ist';
import { ATTENDANCE_STATUSES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
    }

    const south = isSouth(session.facility);
    const facilityClause = south
      ? `h2.facility IN ('WH1','WH2')`
      : `h2.facility = '${session.facility.replace(/'/g, "''")}'`;

    // Shift filter (optional). Whitelisted — never interpolate raw input.
    // Same rule as the Attendance Rate report; anchored to the header shift
    // this query already partitions by (NULL treated as 'Day').
    const shiftParam = searchParams.get('shift') ?? '';
    const shift = shiftParam === 'Day' || shiftParam === 'Night' ? shiftParam : '';
    const shiftClause = shift ? `AND LOWER(TRIM(COALESCE(h2.shift,'Day'))) = '${shift.toLowerCase()}'` : '';

    const raw = await prisma.$queryRawUnsafe<{ department: string; attendance_status: string; cnt: number }[]>(`
      SELECT
        h.department          AS department,
        d.attendance_status   AS attendance_status,
        COUNT(*)::int         AS cnt
      FROM (
        SELECT
          d2.*,
          ROW_NUMBER() OVER (
            PARTITION BY d2.employee_code, d2.attendance_date, h2.facility, h2.department, COALESCE(h2.shift,'Day')
            ORDER BY h2.id DESC, d2.id DESC
          ) AS rn,
          h2.id AS hid
        FROM attendance_detail d2
        JOIN attendance_header h2 ON d2.attendance_header_id = h2.id
        WHERE ${facilityClause} ${shiftClause}
          AND d2.attendance_date BETWEEN $1::date AND $2::date
      ) sub
      JOIN attendance_detail d ON d.id = sub.id
      JOIN attendance_header h ON h.id = sub.hid
      WHERE sub.rn = 1
      GROUP BY h.department, d.attendance_status
      ORDER BY h.department, d.attendance_status
    `, parseISTDate(from), parseISTDate(to));

    const deptMap = new Map<string, Record<string, number>>();
    for (const r of raw) {
      if (!deptMap.has(r.department)) deptMap.set(r.department, {});
      deptMap.get(r.department)![r.attendance_status] = r.cnt;
    }

    const grandTotals: Record<string, number> = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0]));

    const rows = Array.from(deptMap.entries()).map(([department, counts]) => {
      const statusCounts: Record<string, number> = {};
      let total = 0;
      for (const status of ATTENDANCE_STATUSES) {
        const c = counts[status] ?? 0;
        statusCounts[status] = c;
        grandTotals[status] += c;
        total += c;
      }
      return { department, statusCounts, total };
    });

    const grandTotal = Object.values(grandTotals).reduce((a, b) => a + b, 0);

    return NextResponse.json({ shift: shift || 'All', rows, grandTotals, grandTotal });
  } catch (error) {
    console.error('GET /api/reports/department-pivot error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to generate pivot report' }, { status: 500 });
  }
}
