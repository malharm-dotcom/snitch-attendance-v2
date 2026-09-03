import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveAllowedFacilities } from '@/lib/facilityScope';

interface ActionBody {
  request_id: number;
  action: 'approve' | 'reject';
  /** Optional approver comment. Only a REJECT has a column to store it in. */
  comment?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Single-level approval: managers and admins only.
    if (!['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Only managers and admins can approve or reject OT' }, { status: 403 });
    }

    const body: ActionBody = await request.json();
    const { request_id, action } = body;
    const comment = (body.comment ?? '').trim();

    if (!request_id || !action) {
      return NextResponse.json({ error: 'request_id and action are required' }, { status: 400 });
    }
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const target = await prisma.otRequest.findUnique({
      where: { id: request_id },
      select: { id: true, facility: true, status: true, requestedBy: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'OT request not found' }, { status: 404 });
    }

    // Facility scope: an approver may only action requests inside their own allowed
    // facilities. Ids are sequential, so without this a NORTH manager could action a
    // WH1 request by guessing one.
    if (!resolveAllowedFacilities(session).includes(target.facility)) {
      return NextResponse.json({ error: 'Cannot action OT requests from another facility' }, { status: 403 });
    }

    // Same rule as the rewrite flow: nobody actions their own request. Managers can
    // raise OT too, so this is reachable.
    if (target.requestedBy === session.supervisorName) {
      return NextResponse.json({ error: 'You cannot approve or reject your own OT request' }, { status: 403 });
    }

    // Only a Pending request can be actioned — blocks double-approval from two open tabs.
    if (target.status !== 'Pending') {
      return NextResponse.json({ error: `This request is already ${target.status}` }, { status: 409 });
    }

    // approved_at is TIMESTAMPTZ storing UTC, so it takes a true instant. NOT istNow():
    // that returns an offset-shifted Date, correct only for the legacy Timestamp(6)
    // columns that hold IST wall-clock.
    const updated = await prisma.otRequest.updateMany({
      where: { id: request_id, status: 'Pending' },
      data: {
        status: action === 'approve' ? 'Approved' : 'Rejected',
        approvedBy: session.supervisorName,
        approvedAt: new Date(),
        // An approve comment has no column in ot_requests — only rejections keep one.
        ...(action === 'reject' ? { rejectionReason: comment || null } : {}),
      },
    });

    // Lost the race against another approver between the read and the write.
    if (updated.count === 0) {
      return NextResponse.json({ error: 'This request was already actioned' }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/ot/action error:', error);
    return NextResponse.json({ error: 'Failed to process OT action' }, { status: 500 });
  }
}
