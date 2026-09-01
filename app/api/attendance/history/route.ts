import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilitySqlIn } from '@/lib/facilityScope';
import { parseISTDate } from '@/lib/ist';
import { SQL_EFFECTIVE_DEPT, SQL_DEDUP_PARTITION } from '@/lib/reporting';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const department = searchParams.get('department') ?? '';
    const attendance_date = searchParams.get('attendance_date') ?? '';

    if (!department || !attendance_date) {
      return NextResponse.json({ error: 'department and attendance_date are required' }, { status: 400 });
    }

    // h2 is the alias inside the subquery — h.* would cause "missing FROM-clause entry".
    // Facility is resolved server-side from the session — never accepted from the client.
    const facilityClause = facilitySqlIn('h2.facility', resolveFacilityScope(session));

    // $2::date casts the TIMESTAMPTZ parameter to DATE for correct DATE = DATE comparison.
    // The department filter follows the employee's current roster department, so a
    // department move keeps the day visible under the department they are in now.
    const records = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        d.employee_code   AS "EMPLOYEE_CODE",
        d.employee_name   AS "EMPLOYEE_NAME",
        d.attendance_status AS "ATTENDANCE_STATUS",
        d.remarks         AS "REMARKS",
        h.marked_by       AS "MARKED_BY",
        h.marked_at       AS "MARKED_AT",
        h.facility        AS "FACILITY",
        ${SQL_EFFECTIVE_DEPT('e', 'h')} AS "DEPARTMENT"
      FROM (
        SELECT
          d2.*,
          ROW_NUMBER() OVER (
            ${SQL_DEDUP_PARTITION}
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
        LEFT JOIN employees e2 ON e2.employee_code = d2.employee_code
        WHERE ${facilityClause}
          AND ${SQL_EFFECTIVE_DEPT('e2', 'h2')} = $1
          AND d2.attendance_date = $2::date
      ) AS sub
      JOIN attendance_detail d ON d.id = sub.id
      JOIN attendance_header h ON h.id = sub.hid
      LEFT JOIN employees e ON e.employee_code = d.employee_code
      WHERE sub.rn = 1
      ORDER BY sub.employee_name
    `, department, parseISTDate(attendance_date));

    return NextResponse.json({ records });
  } catch (error) {
    console.error('GET /api/attendance/history error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to fetch history' }, { status: 500 });
  }
}
