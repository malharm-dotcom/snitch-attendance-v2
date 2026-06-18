import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseISTDate } from '@/lib/ist';
import { isSouth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const facility = searchParams.get('facility') ?? '';
    const department = searchParams.get('department') ?? '';
    const attendance_date = searchParams.get('attendance_date') ?? '';
    const shift = searchParams.get('shift') ?? '';

    if (!facility || !department || !attendance_date) {
      return NextResponse.json({ error: 'facility, department, and attendance_date are required' }, { status: 400 });
    }

    const parsedDate = parseISTDate(attendance_date);
    const facilityFilter = isSouth(facility) ? { in: ['WH1', 'WH2'] } : { equals: facility };

    const header = await prisma.attendanceHeader.findFirst({
      where: {
        facility: facilityFilter,
        department,
        attendanceDate: parsedDate,
        ...(shift ? { shift } : {}),
      },
      orderBy: { id: 'desc' },
    });

    if (!header) {
      return NextResponse.json({
        submitted: false,
        marked_by: null,
        marked_at: null,
        request_status: null,
        shift: null,
        approved_employee_codes: [],
        legacy_all_approved: false,
        rewrite_summary: null,
      });
    }

    const rewriteReqs = await prisma.attendanceRewriteRequest.findMany({
      where: { facility: facilityFilter, department, attendanceDate: parsedDate },
      orderBy: { id: 'desc' },
    });

    // Build status summary counts
    const summary: Record<string, number> = {};
    for (const r of rewriteReqs) {
      summary[r.requestStatus] = (summary[r.requestStatus] ?? 0) + 1;
    }

    // Legacy: a NULL employee_code row that is approved unlocks all employees
    const legacyAllApproved = rewriteReqs.some(
      (r) => r.employeeCode === null && r.requestStatus === 'approved',
    );

    // Per-employee approved codes (only from rows that have an employee_code)
    const approvedEmployeeCodes = rewriteReqs
      .filter((r) => r.employeeCode !== null && r.requestStatus === 'approved')
      .map((r) => r.employeeCode as string);

    // Most-recent request status for backward compat (e.g. SubmissionBanner fallback)
    const request_status = rewriteReqs.length > 0 ? rewriteReqs[0].requestStatus : null;

    return NextResponse.json({
      submitted: true,
      marked_by: header.markedBy,
      marked_at: header.markedAt,
      request_status,
      shift: header.shift,
      approved_employee_codes: legacyAllApproved ? null : approvedEmployeeCodes,
      legacy_all_approved: legacyAllApproved,
      rewrite_summary: rewriteReqs.length > 0 ? summary : null,
    });
  } catch (error) {
    console.error('GET /api/attendance/check error:', error);
    return NextResponse.json({ error: 'Failed to check submission' }, { status: 500 });
  }
}
