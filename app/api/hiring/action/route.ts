import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveAllowedFacilities } from '@/lib/facilityScope';

/**
 * The one place the hiring lifecycle is encoded.
 *
 *   Pending Manager  --approve(manager|admin)--> Pending HR/Admin
 *   Pending HR/Admin --approve(admin ONLY)-----> Approved
 *   either pending    --reject(+comment)-------> Rejected
 *   Approved         --start(admin)-----------> In Progress
 *   In Progress      --joined(admin)----------> Joined
 *   Joined           --close(admin)-----------> Closed
 *
 * A manager can therefore never produce 'Approved': the only edge into it starts
 * from 'Pending HR/Admin' and is admin-gated.
 */
type Action = 'approve' | 'reject' | 'start' | 'joined' | 'close';

interface ActionBody {
  request_id: number;
  action: Action;
  /** Mandatory for reject. */
  comment?: string;
  /** Required for 'joined'. */
  joined_count?: number | string;
  joined_notes?: string;
}

const ACTIONS: Action[] = ['approve', 'reject', 'start', 'joined', 'close'];

/** Which role may act on a request sitting in this status. */
function gateFor(status: string): { roles: string[]; label: string } | null {
  switch (status) {
    case 'Pending Manager':  return { roles: ['manager', 'admin'], label: 'managers and admins' };
    case 'Pending HR/Admin': return { roles: ['admin'], label: 'admins (HR)' };
    case 'Approved':
    case 'In Progress':
    case 'Joined':           return { roles: ['admin'], label: 'admins (HR)' };
    default:                 return null; // Rejected / Closed are terminal
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ActionBody = await request.json();
    const { request_id, action } = body;
    const comment = (body.comment ?? '').trim();

    if (!request_id || !action) {
      return NextResponse.json({ error: 'request_id and action are required' }, { status: 400 });
    }
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: `action must be one of ${ACTIONS.join(', ')}` }, { status: 400 });
    }

    const target = await prisma.hiringRequest.findUnique({ where: { id: request_id } });
    if (!target) {
      return NextResponse.json({ error: 'Hiring request not found' }, { status: 404 });
    }

    // Facility scope: ids are sequential, so the target is re-checked rather than trusted.
    if (!resolveAllowedFacilities(session).includes(target.facility)) {
      return NextResponse.json({ error: 'Cannot action hiring requests from another facility' }, { status: 403 });
    }

    const gate = gateFor(target.status);
    if (!gate) {
      return NextResponse.json({ error: `A ${target.status} request cannot be actioned` }, { status: 409 });
    }
    if (!gate.roles.includes(session.role)) {
      return NextResponse.json(
        { error: `Only ${gate.label} can action a request at '${target.status}'` },
        { status: 403 },
      );
    }

    // Nobody actions their own request — same rule as the rewrite and OT flows.
    if (target.requestedBy === session.supervisorName) {
      return NextResponse.json({ error: 'You cannot action your own hiring request' }, { status: 403 });
    }

    const now = new Date();  // TIMESTAMPTZ columns store a true UTC instant
    let data: Record<string, unknown>;
    const expected = target.status;

    if (action === 'approve') {
      if (target.status === 'Pending Manager') {
        // A manager approval NEVER lands on 'Approved' — only on the second queue.
        data = { status: 'Pending HR/Admin', mgrApprovedBy: session.supervisorName, mgrApprovedAt: now };
      } else if (target.status === 'Pending HR/Admin') {
        // Two-step means two people: whoever gave the manager approval cannot also
        // give the final one, even though an admin is allowed at both stages.
        if (target.mgrApprovedBy === session.supervisorName) {
          return NextResponse.json(
            { error: 'You gave the manager approval; final approval needs a different person' },
            { status: 403 },
          );
        }
        data = { status: 'Approved', adminApprovedBy: session.supervisorName, adminApprovedAt: now };
      } else {
        return NextResponse.json({ error: `Cannot approve a request at '${target.status}'` }, { status: 409 });
      }
    } else if (action === 'reject') {
      if (!['Pending Manager', 'Pending HR/Admin'].includes(target.status)) {
        return NextResponse.json({ error: `Cannot reject a request at '${target.status}'` }, { status: 409 });
      }
      // Mandatory comment. The DB CHECK enforces this too, but a clear 400 beats a 500.
      if (!comment) {
        return NextResponse.json({ error: 'A comment is required when rejecting' }, { status: 400 });
      }
      data = { status: 'Rejected', rejectionReason: comment };
    } else if (action === 'start') {
      if (target.status !== 'Approved') {
        return NextResponse.json({ error: `Only an Approved request can be moved to In Progress` }, { status: 409 });
      }
      data = { status: 'In Progress' };
    } else if (action === 'joined') {
      if (target.status !== 'In Progress') {
        return NextResponse.json({ error: 'Only an In Progress request can record joiners' }, { status: 409 });
      }
      const joined = Number(body.joined_count);
      if (!Number.isInteger(joined) || joined < 0 || joined > target.headcount) {
        return NextResponse.json(
          { error: `joined_count must be a whole number between 0 and ${target.headcount}` },
          { status: 400 },
        );
      }
      // A PARTIAL join stays 'In Progress' on purpose. Open Positions counts
      // SUM(headcount - joined_count) over Approved + In Progress, so flipping to
      // 'Joined' at 2 of 6 would drop the other 4 out of the open pool and understate
      // the requirement. Only a full intake closes the role out.
      data = {
        status: joined >= target.headcount ? 'Joined' : 'In Progress',
        joinedCount: joined,
        joinedNotes: (body.joined_notes ?? '').trim() || null,
      };
    } else {
      if (target.status !== 'Joined') {
        return NextResponse.json({ error: 'Only a Joined request can be closed' }, { status: 409 });
      }
      data = { status: 'Closed', closedAt: now };
    }

    // Status-guarded write: two open tabs cannot double-advance the same request.
    const updated = await prisma.hiringRequest.updateMany({
      where: { id: request_id, status: expected },
      data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: 'This request was already actioned' }, { status: 409 });
    }

    return NextResponse.json({ success: true, status: data.status });
  } catch (error) {
    console.error('POST /api/hiring/action error:', error);
    return NextResponse.json({ error: 'Failed to process hiring action' }, { status: 500 });
  }
}
