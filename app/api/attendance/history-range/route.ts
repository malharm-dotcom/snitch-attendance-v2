import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseISTDate, formatAttendanceDate } from '@/lib/ist';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilitySqlIn } from '@/lib/facilityScope';
import { SQL_EFFECTIVE_DEPT, SQL_DEDUP_PARTITION } from '@/lib/reporting';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const department = searchParams.get('department') ?? '';
    const from_date = searchParams.get('from_date') ?? '';
    const to_date = searchParams.get('to_date') ?? '';

    if (!department || !from_date || !to_date) {
      return NextResponse.json({ error: 'department, from_date, and to_date are required' }, { status: 400 });
    }

    // h2 is the alias used inside the subquery.
    // Facility is resolved server-side from the session — never accepted from the client.
    const facilityClause = facilitySqlIn('h2.facility', resolveFacilityScope(session));

    const parsedFrom = parseISTDate(from_date);
    const parsedTo = parseISTDate(to_date);

    // The department filter follows the EMPLOYEE (e2.department), not the header
    // snapshot — otherwise a department move hides every past day of that employee.
    const allDepts = department === '__all__';
    const deptClause = allDepts ? '' : `AND ${SQL_EFFECTIVE_DEPT('e2', 'h2')} = $1`;
    const fromParam = allDepts ? '$1::date' : '$2::date';
    const toParam   = allDepts ? '$2::date' : '$3::date';
    const queryParams: unknown[] = allDepts ? [parsedFrom, parsedTo] : [department, parsedFrom, parsedTo];

    const records = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        d.employee_code      AS "EMPLOYEE_CODE",
        d.employee_name      AS "EMPLOYEE_NAME",
        COALESCE(TO_CHAR(e.joining_date, 'YYYY-MM-DD'), '') AS "JOINING_DATE",
        COALESCE(TO_CHAR(e.exit_date,    'YYYY-MM-DD'), '') AS "EXIT_DATE",
        d.attendance_status  AS "ATTENDANCE_STATUS",
        d.remarks            AS "REMARKS",
        h.marked_by          AS "MARKED_BY",
        h.marked_at          AS "MARKED_AT",
        h.facility           AS "FACILITY",
        ${SQL_EFFECTIVE_DEPT('e', 'h')} AS "DEPARTMENT",
        COALESCE(e.reporting_manager, '') AS "REPORTING_MANAGER",
        -- Roster shift, like department: one row per employee here, so the per-day
        -- header shift has nowhere to go.
        COALESCE(e.shift, '') AS "SHIFT",
        -- Raw stored column. Hygiene ("Off-Role" -> "Off-Roll", NULL -> "Not
        -- specified") is applied at read time by normalizeRollType().
        COALESCE(e.roll_type, '') AS "ROLL_TYPE",
        d.attendance_date    AS "ATTENDANCE_DATE"
      FROM (
        SELECT
          d2.*,
          ROW_NUMBER() OVER (
            ${SQL_DEDUP_PARTITION}
            ORDER BY h2.id DESC, d2.id DESC
          ) AS rn,
          h2.id AS hid
        FROM attendance_detail d2
        JOIN attendance_header h2 ON d2.attendance_header_id = h2.id
        LEFT JOIN employees e2 ON e2.employee_code = d2.employee_code
        WHERE ${facilityClause}
          ${deptClause}
          AND d2.attendance_date BETWEEN ${fromParam} AND ${toParam}
      ) AS sub
      JOIN attendance_detail d ON d.id = sub.id
      JOIN attendance_header h ON h.id = sub.hid
      LEFT JOIN employees e ON e.employee_code = d.employee_code
      WHERE sub.rn = 1
      ORDER BY sub.attendance_date, sub.employee_name
    `, ...queryParams);

    const formatted = records.map((r) => ({
      ...r,
      ATTENDANCE_DATE: r.ATTENDANCE_DATE instanceof Date
        ? formatAttendanceDate(r.ATTENDANCE_DATE as Date)
        : r.ATTENDANCE_DATE,
    }));

    return NextResponse.json({ records: formatted });
  } catch (error) {
    console.error('GET /api/attendance/history-range error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to fetch history range' }, { status: 500 });
  }
}
