import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, isSouth } from '@/lib/auth';
import { parseISTDate, formatAttendanceDate } from '@/lib/ist';

/**
 * Read-only rewrite-request state for the 7-day history strip cells.
 * Returns, per employee, the LATEST rewrite request status on each of the 7 days
 * before the selected date, so each cell can show its pending/approved/rejected/used
 * affordance. Reuses the existing attendance_rewrite_requests table (no writes here).
 *
 * Facility is derived SERVER-SIDE from session (South WH1/WH2 cross-visible, NORTH
 * isolated). Dates are plain calendar DATEs (::date semantics via parseISTDate),
 * zero timezone shift — mirrors app/api/attendance/history-strip/route.ts.
 *
 * Query params:
 *   attendance_date = the selected date (YYYY-MM-DD); window = the 7 days before it
 *   employee_codes  = comma-separated codes currently loaded on screen
 *
 * Response: { cellStatus: { [employee_code]: { [YYYY-MM-DD]: request_status } } }
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
      return NextResponse.json({ cellStatus: {} });
    }

    // 7-day window ending the day BEFORE the selected date (both bounds inclusive).
    const selected = parseISTDate(attendance_date);
    const to = new Date(selected.getTime() - 86400000);
    const from = new Date(selected.getTime() - 7 * 86400000);

    const facilityFilter = isSouth(session.facility)
      ? { in: ['WH1', 'WH2'] }
      : { equals: session.facility };

    const reqs = await prisma.attendanceRewriteRequest.findMany({
      where: {
        facility: facilityFilter,
        employeeCode: { in: codes },
        attendanceDate: { gte: from, lte: to },
      },
      orderBy: { id: 'desc' }, // latest first → first seen per (code,date) wins
    });

    const cellStatus: Record<string, Record<string, string>> = {};
    for (const r of reqs) {
      if (!r.employeeCode) continue;
      const day = formatAttendanceDate(r.attendanceDate);
      if (!cellStatus[r.employeeCode]) cellStatus[r.employeeCode] = {};
      // Keep only the most recent request per (employee, date)
      if (cellStatus[r.employeeCode][day] === undefined) {
        cellStatus[r.employeeCode][day] = r.requestStatus;
      }
    }

    return NextResponse.json({ cellStatus });
  } catch (error) {
    console.error('GET /api/rewrite/cell-status error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to fetch cell status' }, { status: 500 });
  }
}
