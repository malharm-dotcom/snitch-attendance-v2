import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilitySqlIn } from '@/lib/facilityScope';
import { parseISTDate, formatAttendanceDate } from '@/lib/ist';

/**
 * Read-only 7-day history strip for the Mark Attendance screen.
 * Returns, for each requested employee, their attendance status on the 7 calendar
 * days ENDING THE DAY BEFORE the selected date.
 *
 * Facility is derived SERVER-SIDE from the session — never from query params.
 * Date handling mirrors app/api/attendance/history/route.ts: attendance_date is a
 * plain calendar DATE, compared via ::date with zero timezone shift.
 *
 * Query params:
 *   attendance_date  = the selected date (YYYY-MM-DD) — strip covers the 7 days before it
 *   employee_codes   = comma-separated employee codes currently loaded on screen
 *
 * Response: { strip: { [employee_code]: { [YYYY-MM-DD]: status } } }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const attendance_date = searchParams.get('attendance_date') ?? '';
    const codesParam = searchParams.get('employee_codes') ?? '';

    if (!attendance_date) {
      return NextResponse.json({ error: 'attendance_date is required' }, { status: 400 });
    }

    const codes = codesParam.split(',').map((c) => c.trim()).filter(Boolean);
    if (codes.length === 0) {
      return NextResponse.json({ strip: {} });
    }

    // 7-day window ending the day BEFORE the selected date (both bounds inclusive).
    const selected = parseISTDate(attendance_date); // UTC midnight, calendar-safe
    const to = new Date(selected.getTime() - 86400000);      // selected - 1 day
    const from = new Date(selected.getTime() - 7 * 86400000); // selected - 7 days

    // Facility scoping derived from session via the single choke point
    // (South = WH1/WH2 cross-visible, NORTH isolated, all-access = the selected facility).
    const facilityClause = facilitySqlIn('h2.facility', resolveFacilityScope(session));

    // Dedup to the latest header/detail per (employee, date) exactly like the history route.
    const params: unknown[] = [codes, from, to];

    const records = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT
        sub.employee_code    AS "EMPLOYEE_CODE",
        sub.attendance_date  AS "ATTENDANCE_DATE",
        d.attendance_status  AS "ATTENDANCE_STATUS"
      FROM (
        SELECT
          d2.id,
          d2.employee_code,
          d2.attendance_date,
          ROW_NUMBER() OVER (
            PARTITION BY d2.employee_code, d2.attendance_date, h2.facility, h2.department, COALESCE(h2.shift,'Day')
            ORDER BY h2.id DESC, d2.id DESC
          ) AS rn
        FROM attendance_detail d2
        JOIN attendance_header h2 ON d2.attendance_header_id = h2.id
        WHERE ${facilityClause}
          AND d2.employee_code = ANY($1)
          AND d2.attendance_date >= $2::date
          AND d2.attendance_date <= $3::date
      ) AS sub
      JOIN attendance_detail d ON d.id = sub.id
      WHERE sub.rn = 1
    `, ...params);

    const strip: Record<string, Record<string, string>> = {};
    for (const r of records) {
      const code = r.EMPLOYEE_CODE as string;
      const day = formatAttendanceDate(r.ATTENDANCE_DATE as Date);
      const status = (r.ATTENDANCE_STATUS as string) ?? '';
      if (!strip[code]) strip[code] = {};
      strip[code][day] = status;
    }

    return NextResponse.json({ strip });
  } catch (error) {
    console.error('GET /api/attendance/history-strip error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to fetch history strip' }, { status: 500 });
  }
}
