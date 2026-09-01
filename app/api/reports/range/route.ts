import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilitySqlIn } from '@/lib/facilityScope';
import { parseISTDate, formatAttendanceDate, istTimestamp } from '@/lib/ist';
import { SQL_EFFECTIVE_DEPT, SQL_DEDUP_PARTITION } from '@/lib/reporting';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const from_date = searchParams.get('from_date') ?? '';
    const to_date = searchParams.get('to_date') ?? '';
    const department = searchParams.get('department') ?? '';
    const shift = searchParams.get('shift') ?? '';

    if (!from_date || !to_date) {
      return NextResponse.json({ error: 'from_date and to_date are required' }, { status: 400 });
    }

    // Facility resolved server-side from the session. The old '1=1' fallback is gone:
    // an unscoped query would sweep in the North_Wh ghost batch (see lib/reporting.ts).
    const scope = resolveFacilityScope(session);
    const facilityClause = facilitySqlIn('h2.facility', scope);

    // Department follows the EMPLOYEE's current roster department, not the header
    // snapshot — a department move must not hide days marked under the old one.
    const deptClause = department
      ? `AND ${SQL_EFFECTIVE_DEPT('e2', 'h2')} = '${department.replace(/'/g, "''")}'`
      : '';

    const shiftClause = shift
      ? `AND h2.shift = '${shift.replace(/'/g, "''")}'`
      : '';

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
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
        h.shift              AS "SHIFT",
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
        WHERE ${facilityClause} ${deptClause} ${shiftClause}
          AND d2.attendance_date BETWEEN $1::date AND $2::date
      ) sub
      JOIN attendance_detail d ON d.id = sub.id
      JOIN attendance_header h ON h.id = sub.hid
      LEFT JOIN employees e ON e.employee_code = d.employee_code
      WHERE sub.rn = 1
      ORDER BY d.attendance_date, h.facility, "DEPARTMENT", d.employee_name
    `, parseISTDate(from_date), parseISTDate(to_date));

    const formatted = rows.map((r) => ({
      ...r,
      ATTENDANCE_DATE: r.ATTENDANCE_DATE instanceof Date
        ? formatAttendanceDate(r.ATTENDANCE_DATE)
        : r.ATTENDANCE_DATE,
      MARKED_AT: r.MARKED_AT instanceof Date
        ? istTimestamp(r.MARKED_AT)
        : r.MARKED_AT,
    }));

    return NextResponse.json({ scope: scope.label, rows: formatted });
  } catch (error) {
    console.error('GET /api/reports/range error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to generate range report' }, { status: 500 });
  }
}
