import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilityPrismaFilter } from '@/lib/facilityScope';
import { formatAttendanceDate } from '@/lib/ist';

const STATUSES = ['Pending', 'Approved', 'Rejected'];

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = request.nextUrl.searchParams.get('status');
    if (status && !STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
    }

    // Facility is resolved server-side from the session — an approver never sees a
    // request outside their allowed set.
    const facilityFilter = facilityPrismaFilter(resolveFacilityScope(session));

    const requests = await prisma.otRequest.findMany({
      where: {
        facility: facilityFilter,
        ...(status ? { status } : {}),
      },
      orderBy: [{ status: 'asc' }, { otDate: 'desc' }, { id: 'desc' }],
      include: { employee: { select: { employeeName: true, department: true } } },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        employee_code: r.employeeCode,
        employee_name: r.employee?.employeeName ?? '',
        department: r.employee?.department ?? '',
        facility: r.facility,
        // Calendar date — formatted as plain YYYY-MM-DD, never timezone-shifted.
        ot_date: formatAttendanceDate(r.otDate),
        ot_hours: Number(r.otHours),
        reason: r.reason,
        status: r.status,
        requested_by: r.requestedBy,
        approved_by: r.approvedBy,
        approved_at: r.approvedAt,
        rejection_reason: r.rejectionReason,
        created_at: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/ot/list error:', error);
    return NextResponse.json({ error: 'Failed to fetch OT requests' }, { status: 500 });
  }
}
