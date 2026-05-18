import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseISTDate } from '@/lib/ist';
import { isSouth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const from_date = searchParams.get('from_date') ?? '';
    const to_date = searchParams.get('to_date') ?? '';
    const facility = searchParams.get('facility') ?? '';
    const department = searchParams.get('department') ?? '';
    const shift = searchParams.get('shift') ?? '';

    if (!from_date || !to_date) {
      return NextResponse.json({ error: 'from_date and to_date are required' }, { status: 400 });
    }

    const parsedFrom = parseISTDate(from_date);
    const parsedTo = parseISTDate(to_date);

    const south = facility ? isSouth(facility) : false;
    const facilityClause = facility
      ? south
        ? `h.facility IN ('WH1','WH2')`
        : `h.facility = '${facility.replace(/'/g, "''")}'`
      : '1=1';

    const deptClause = department
      ? `AND h.department = '${department.replace(/'/g, "''")}'`
      : '';

    const shiftClause = shift
      ? `AND h.shift = '${shift.replace(/'/g, "''")}'`
      : '';

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        d.employee_code      AS "EMPLOYEE_CODE",
        d.employee_name      AS "EMPLOYEE_NAME",
        d.attendance_status  AS "ATTENDANCE_STATUS",
        d.remarks            AS "REMARKS",
        h.marked_by          AS "MARKED_BY",
        h.marked_at          AS "MARKED_AT",
        h.facility           AS "FACILITY",
        h.department         AS "DEPARTMENT",
        h.shift              AS "SHIFT",
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
        WHERE ${facilityClause} ${deptClause} ${shiftClause}
          AND d2.attendance_date BETWEEN $1 AND $2
      ) sub
      JOIN attendance_detail d ON d.id = sub.id
      JOIN attendance_header h ON h.id = sub.hid
      WHERE sub.rn = 1
      ORDER BY d.attendance_date, h.facility, h.department, d.employee_name
    `, parsedFrom, parsedTo);

    return NextResponse.json({ rows });
  } catch (error) {
    console.error('GET /api/reports/range error:', error);
    return NextResponse.json({ error: 'Failed to generate range report' }, { status: 500 });
  }
}
