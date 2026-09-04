import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilityPrismaFilter } from '@/lib/facilityScope';

/** Statuses that still represent unfilled demand. */
const OPEN_STATUSES = ['Approved', 'In Progress'];
const PENDING_STATUSES = ['Pending Manager', 'Pending HR/Admin'];

export interface HiringSummary {
  scope: string;
  cards: {
    total: number;
    pendingApprovals: number;
    approved: number;
    inProgress: number;
    openPositions: number;
    joined: number;
    rejected: number;
    closed: number;
  };
  byDepartment: { department: string; openHeadcount: number; requests: number }[];
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Facility resolved server-side — the whole summary is scoped to the session.
    const scope = resolveFacilityScope(session);
    const facility = facilityPrismaFilter(scope);

    const byStatus = await prisma.hiringRequest.groupBy({
      by: ['status'],
      where: { facility },
      _count: { _all: true },
      _sum: { headcount: true, joinedCount: true },
    });

    const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;

    // Open Positions = SUM(headcount - joined_count) over Approved + In Progress.
    // SUM is linear, so SUM(a) - SUM(b) is the same thing and groupBy can express it.
    const openPositions = byStatus
      .filter((r) => OPEN_STATUSES.includes(r.status))
      .reduce((acc, r) => acc + (r._sum.headcount ?? 0) - (r._sum.joinedCount ?? 0), 0);

    // Department-wise requirement: the same open pool, split by department.
    const byDept = await prisma.hiringRequest.groupBy({
      by: ['department'],
      where: { facility, status: { in: OPEN_STATUSES } },
      _count: { _all: true },
      _sum: { headcount: true, joinedCount: true },
    });

    const summary: HiringSummary = {
      scope: scope.label,
      cards: {
        total: byStatus.reduce((a, r) => a + r._count._all, 0),
        pendingApprovals: PENDING_STATUSES.reduce((a, s) => a + count(s), 0),
        approved: count('Approved'),
        inProgress: count('In Progress'),
        openPositions,
        joined: count('Joined'),
        rejected: count('Rejected'),
        closed: count('Closed'),
      },
      byDepartment: byDept
        .map((r) => ({
          department: r.department,
          openHeadcount: (r._sum.headcount ?? 0) - (r._sum.joinedCount ?? 0),
          requests: r._count._all,
        }))
        // Biggest gap first; that is what the table is read for.
        .sort((a, b) => b.openHeadcount - a.openHeadcount || a.department.localeCompare(b.department)),
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('GET /api/hiring/summary error:', error);
    return NextResponse.json({ error: 'Failed to build hiring summary' }, { status: 500 });
  }
}
