import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isSouth } from '@/lib/auth';
import { parseISTDate } from '@/lib/ist';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const facility = searchParams.get('facility') ?? '';
    const department = searchParams.get('department') ?? '';
    const attendance_date = searchParams.get('attendance_date') ?? '';

    if (!facility || !department || !attendance_date) {
      return NextResponse.json({ error: 'facility, department, and attendance_date are required' }, { status: 400 });
    }

    const south = isSouth(facility);
    // h2 is the alias inside the subquery — h.* would cause "missing FROM-clause entry"
    const facilityClause = south
      ? `h2.facility IN ('WH1','WH2')`
      : `h2.facility = '${facility.replace(/'/g, "''")}'`;

    // $2::date casts the TIMESTAMPTZ parameter to DATE for correct DATE = DATE comparison
    const records = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        d.employee_code   AS "EMPLOYEE_CODE",
        d.employee_name   AS "EMPLOYEE_NAME",
        d.attendance_status AS "ATTENDANCE_STATUS",
        d.remarks         AS "REMARKS",
        h.marked_by       AS "MARKED_BY",
        h.marked_at       AS "MARKED_AT",
        h.facility        AS "FACILITY",
        h.department      AS "DEPARTMENT"
      FROM (
        SELECT
          d2.*,
          ROW_NUMBER() OVER (
            PARTITION BY d2.employee_code, d2.attendance_date, h2.facility, h2.department, COALESCE(h2.shift,'Day')
            ORDER BY h2.id DESC, d2.id DESC
          ) AS rn,
          h2.id AS hid,
          h2.marked_by,
          h2.marked_at,
          h2.facility,
          h2.department,
          h2.shift
        FROM attendance_detail d2
        JOIN attendance_header h2 ON d2.attendance_header_id = h2.id
        WHERE ${facilityClause}
          AND h2.department = $1
          AND d2.attendance_date = $2::date
      ) AS sub
      JOIN attendance_detail d ON d.id = sub.id
      JOIN attendance_header h ON h.id = sub.hid
      WHERE sub.rn = 1
      ORDER BY sub.employee_name
    `, department, parseISTDate(attendance_date));

    return NextResponse.json({ records });
  } catch (error) {
    console.error('GET /api/attendance/history error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to fetch history' }, { status: 500 });
  }
}
