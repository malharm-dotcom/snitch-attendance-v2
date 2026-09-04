import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilityPrismaFilter } from '@/lib/facilityScope';
import { formatAttendanceDate } from '@/lib/ist';

// Not exported: a Next.js route module may only export route handlers and its
// config, and an extra value export breaks the generated route types.
const HIRING_STATUSES = [
  'Pending Manager', 'Pending HR/Admin', 'Approved',
  'Rejected', 'In Progress', 'Joined', 'Closed',
] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = request.nextUrl.searchParams.get('status');
    if (status && !HIRING_STATUSES.includes(status as (typeof HIRING_STATUSES)[number])) {
      return NextResponse.json({ error: `Unknown status '${status}'` }, { status: 400 });
    }

    // Facility resolved server-side — an approver never sees another facility's requests.
    const requests = await prisma.hiringRequest.findMany({
      where: {
        facility: facilityPrismaFilter(resolveFacilityScope(session)),
        ...(status ? { status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        department: r.department,
        sub_department: r.subDepartment,
        position: r.position,
        headcount: r.headcount,
        facility: r.facility,
        req_type: r.reqType,
        justification: r.justification,
        requested_by: r.requestedBy,
        // Calendar date — plain YYYY-MM-DD, never timezone-shifted.
        expected_joining_date: formatAttendanceDate(r.expectedJoiningDate),
        status: r.status,
        mgr_approved_by: r.mgrApprovedBy,
        mgr_approved_at: r.mgrApprovedAt,
        admin_approved_by: r.adminApprovedBy,
        admin_approved_at: r.adminApprovedAt,
        rejection_reason: r.rejectionReason,
        joined_count: r.joinedCount,
        joined_notes: r.joinedNotes,
        created_at: r.createdAt,
        closed_at: r.closedAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/hiring/list error:', error);
    return NextResponse.json({ error: 'Failed to fetch hiring requests' }, { status: 500 });
  }
}
