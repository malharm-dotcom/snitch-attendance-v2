import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseISTDate, formatAttendanceDate } from '@/lib/ist';
import { isSouth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const facility = searchParams.get('facility') ?? '';
    const department = searchParams.get('department') ?? '';
    const from_date = searchParams.get('from_date') ?? '';
    const to_date = searchParams.get('to_date') ?? '';

    if (!facility || !department || !from_date || !to_date) {
      return NextResponse.json({ error: 'facility, department, from_date, and to_date are required' }, { status: 400 });
    }

    const south = isSouth(facility);
    // h2 is the alias used inside the subquery
    const facilityClause = south
      ? `h2.facility IN ('WH1','WH2')`
      : `h2.facility = '${facility.replace(/'/g, "''")}'`;

    const parsedFrom = parseISTDate(from_date);
    const parsedTo = parseISTDate(to_date);

    const allDepts = department === '__all__';
    const deptClause = allDepts ? '' : `AND h2.department = $1`;
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
        h.department         AS "DEPARTMENT",
        d.attendance_date    AS "ATTENDANCE_DATE"
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
