import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isSouth } from '@/lib/auth';
import { parseISTDate } from '@/lib/ist';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date') ?? '';
    const shift = searchParams.get('shift') ?? '';
    const facility = searchParams.get('facility') ?? '';

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    const south = isSouth(facility);
    const facilityClause = facility
      ? south
        ? `h2.facility IN ('WH1','WH2')`
        : `h2.facility = '${facility.replace(/'/g, "''")}'`
      : '1=1';

    const shiftClause = shift ? `AND h2.shift = '${shift.replace(/'/g, "''")}'` : '';

    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        h.department,
        h.facility,
        d.attendance_status,
        e.roll_type,
        e.gender,
        COUNT(*) AS cnt
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
          AND d2.attendance_date = $1
      ) sub
      JOIN attendance_detail d ON d.id = sub.id
      JOIN attendance_header h ON h.id = sub.hid
      LEFT JOIN employees e ON e.employee_code = d.employee_code
      WHERE sub.rn = 1
      GROUP BY h.department, h.facility, d.attendance_status, e.roll_type, e.gender
      ORDER BY h.facility, h.department
    `, parseISTDate(date));

    return NextResponse.json({ rows });
  } catch (error) {
    console.error('GET /api/reports/daily-summary error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to generate report' }, { status: 500 });
  }
}
