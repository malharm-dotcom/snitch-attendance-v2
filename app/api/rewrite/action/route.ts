import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { istNow } from '@/lib/ist';
import { getSession } from '@/lib/auth';

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

    const body: ActionBody = await request.json();
    const { action, request_ids } = body;
    const request_id = body.request_id;

    if (!action || (!request_id && !request_ids?.length)) {
      return NextResponse.json({ error: 'action and request_id(s) are required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const actionedAt = istNow();
    const actionedBy = session.supervisorName;

    const ids = request_ids ?? [request_id];

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
