import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilitySqlIn } from '@/lib/facilityScope';
import { parseISTDate } from '@/lib/ist';

export interface OtReportRow {
  employeeCode: string;
  employeeName: string;
  department: string;
  facility: string;
  /** YYYY-MM — derived from ot_date, a calendar date, with no timezone conversion. */
  month: string;
  approvedHours: number;
  pending: number;
  approved: number;
  rejected: number;
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
    if (from > to) {
      return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 });
    }

    // Facility resolved server-side from the session — never accepted from the client.
    const scope = resolveFacilityScope(session);
    const facilityClause = facilitySqlIn('o.facility', scope);

    // ot_date is a calendar DATE: TO_CHAR reads its stored Y/M/D directly, so the month
    // bucket never shifts. No AT TIME ZONE anywhere near it.
    const rows = await prisma.$queryRawUnsafe<
      {
        employee_code: string;
        employee_name: string;
        department: string;
        facility: string;
        month: string;
        approved_hours: string | null;
        pending: bigint;
        approved: bigint;
        rejected: bigint;
      }[]
    >(
      `SELECT
         o.employee_code                       AS employee_code,
         COALESCE(e.employee_name, '')         AS employee_name,
         COALESCE(e.department, '')            AS department,
         o.facility                            AS facility,
         TO_CHAR(o.ot_date, 'YYYY-MM')         AS month,
         COALESCE(SUM(o.ot_hours) FILTER (WHERE o.status = 'Approved'), 0) AS approved_hours,
         COUNT(*) FILTER (WHERE o.status = 'Pending')  AS pending,
         COUNT(*) FILTER (WHERE o.status = 'Approved') AS approved,
         COUNT(*) FILTER (WHERE o.status = 'Rejected') AS rejected
       FROM ot_requests o
       LEFT JOIN employees e ON e.employee_code = o.employee_code
       WHERE ${facilityClause}
         AND o.ot_date BETWEEN $1::date AND $2::date
       GROUP BY o.employee_code, e.employee_name, e.department, o.facility, TO_CHAR(o.ot_date, 'YYYY-MM')
       ORDER BY month DESC, employee_name ASC, employee_code ASC`,
      parseISTDate(from),
      parseISTDate(to),
    );

    const result: OtReportRow[] = rows.map((r) => ({
      employeeCode: r.employee_code,
      employeeName: r.employee_name,
      department: r.department,
      facility: r.facility,
      month: r.month,
      approvedHours: Number(r.approved_hours ?? 0),
      pending: Number(r.pending),
      approved: Number(r.approved),
      rejected: Number(r.rejected),
    }));

    return NextResponse.json({
      scope: scope.label,
      rows: result,
      totals: {
        approvedHours: result.reduce((a, r) => a + r.approvedHours, 0),
        pending: result.reduce((a, r) => a + r.pending, 0),
        approved: result.reduce((a, r) => a + r.approved, 0),
        rejected: result.reduce((a, r) => a + r.rejected, 0),
      },
    });
  } catch (error) {
    console.error('GET /api/reports/ot error:', error);
    return NextResponse.json({ error: 'Failed to build OT report' }, { status: 500 });
  }
}
