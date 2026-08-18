import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { istNow } from '@/lib/ist';
import { getSession } from '@/lib/auth';
import { resolveAllowedFacilities } from '@/lib/facilityScope';

interface ActionBody {
  request_id: number;
  action: 'approve' | 'reject';
  request_ids?: number[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Only managers and admins can approve or reject requests' }, { status: 403 });
    }

    const body: ActionBody = await request.json();
    const { action, request_ids } = body;
    const request_id = body.request_id;

    if (!action || (!request_id && !request_ids?.length)) {
      return NextResponse.json({ error: 'action and request_id(s) are required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const ids = request_ids ?? [request_id];

    // Facility scope: an approver may only action requests inside their own allowed
    // facilities. Without this a NORTH manager could approve a WH1 request by guessing
    // its id — the ids are sequential and were never scope-checked.
    const targets = await prisma.attendanceRewriteRequest.findMany({
      where: { id: { in: ids } },
      select: { id: true, facility: true, supervisorName: true },
    });
    if (targets.length !== ids.length) {
      return NextResponse.json({ error: 'One or more requests were not found' }, { status: 404 });
    }
    const allowedFacilities = resolveAllowedFacilities(session);
    if (targets.some((t) => !allowedFacilities.includes(t.facility))) {
      return NextResponse.json({ error: 'Cannot action rewrite requests from another facility' }, { status: 403 });
    }

    // Block self-approval: reject any request where the requester is the current user
    if (targets.some((t) => t.supervisorName === session.supervisorName)) {
      return NextResponse.json({ error: 'You cannot approve or reject your own rewrite request' }, { status: 403 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const actionedAt = istNow();
    const actionedBy = session.supervisorName;

    await prisma.attendanceRewriteRequest.updateMany({
      where: { id: { in: ids } },
      data: { requestStatus: newStatus, actionedBy, actionedAt },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/rewrite/action error:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
