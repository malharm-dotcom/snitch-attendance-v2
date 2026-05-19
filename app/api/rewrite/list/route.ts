import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, isSouth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');

    // WH1 and WH2 are adjacent — admins/managers see both facilities' requests
    const facilityFilter = isSouth(session.facility)
      ? { in: ['WH1', 'WH2'] }
      : { equals: session.facility };

    const requests = await prisma.attendanceRewriteRequest.findMany({
      where: {
        facility: facilityFilter,
        ...(status ? { requestStatus: status } : {}),
      },
      orderBy: { requestedAt: 'desc' },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        request_id: r.id,
        attendance_date: r.attendanceDate,
        facility: r.facility,
        department: r.department,
        supervisor_name: r.supervisorName,
        reason: r.reason,
        request_status: r.requestStatus,
        requested_at: r.requestedAt,
        actioned_by: r.actionedBy,
        actioned_at: r.actionedAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/rewrite/list error:', error);
    return NextResponse.json({ error: 'Failed to fetch rewrite requests' }, { status: 500 });
  }
}
