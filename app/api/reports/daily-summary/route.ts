import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilitySqlIn } from '@/lib/facilityScope';
import { parseISTDate } from '@/lib/ist';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date') ?? '';
    const shift = searchParams.get('shift') ?? '';

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    // Facility resolved server-side from the session. The old '1=1' fallback is gone:
    // an unscoped query would sweep in the North_Wh ghost batch (see lib/reporting.ts).
    const scope = resolveFacilityScope(session);
    const facilityClause = facilitySqlIn('h2.facility', scope);

    const shiftClause = shift ? `AND h2.shift = '${shift.replace(/'/g, "''")}'` : '';

    // COUNT(*)::int avoids BigInt which cannot be JSON-serialized
    // $1::date casts the TIMESTAMPTZ parameter to DATE for correct DATE = DATE comparison
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        h.department,
        h.facility,
        d.attendance_status,
        e.roll_type,
        e.gender,
        COUNT(*)::int AS cnt
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
          AND d2.attendance_date = $1::date
      ) sub
      JOIN attendance_detail d ON d.id = sub.id
      JOIN attendance_header h ON h.id = sub.hid
      LEFT JOIN employees e ON e.employee_code = d.employee_code
      WHERE sub.rn = 1
      GROUP BY h.department, h.facility, d.attendance_status, e.roll_type, e.gender
      ORDER BY h.facility, h.department
    `, parseISTDate(date));

    return NextResponse.json({ scope: scope.label, rows });
  } catch (error) {
    console.error('GET /api/reports/daily-summary error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to generate report' }, { status: 500 });
  }
}
