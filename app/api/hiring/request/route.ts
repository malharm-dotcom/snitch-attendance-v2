import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseISTDate } from '@/lib/ist';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope } from '@/lib/facilityScope';

interface HiringRequestBody {
  department: string;
  sub_department?: string;
  position: string;
  headcount: number | string;
  req_type: 'New' | 'Replacement';
  justification: string;
  expected_joining_date: string;
  /** Never trusted — present only so a spoof is rejected loudly rather than ignored. */
  facility?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REQ_TYPES = ['New', 'Replacement'];
/** Sanity ceiling; the DB also enforces headcount > 0. */
const MAX_HEADCOUNT = 500;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: HiringRequestBody = await request.json();
    const department = (body.department ?? '').trim();
    const subDepartment = (body.sub_department ?? '').trim();
    const position = (body.position ?? '').trim();
    const justification = (body.justification ?? '').trim();
    const expected = (body.expected_joining_date ?? '').trim();
    const reqType = (body.req_type ?? '').trim();

    // --- facility: resolved SERVER-SIDE, never from the client -----------------
    const scope = resolveFacilityScope(session);
    if (!scope.active) {
      return NextResponse.json(
        { error: 'Select a specific facility before raising a hiring request. "All facilities" is read-only.' },
        { status: 400 },
      );
    }
    if (body.facility !== undefined && !scope.allowed.includes(body.facility)) {
      return NextResponse.json(
        { error: `Facility '${body.facility}' is outside your allowed scope (${scope.allowed.join(', ')})` },
        { status: 403 },
      );
    }

    // --- field validation (trust boundary; the DB CHECKs are the second line) ---
    if (!department || !position || !justification || !expected || !reqType) {
      return NextResponse.json(
        { error: 'department, position, req_type, expected_joining_date and justification are required' },
        { status: 400 },
      );
    }
    if (!REQ_TYPES.includes(reqType)) {
      return NextResponse.json({ error: "req_type must be 'New' or 'Replacement'" }, { status: 400 });
    }
    if (!DATE_RE.test(expected)) {
      return NextResponse.json({ error: 'expected_joining_date must be YYYY-MM-DD' }, { status: 400 });
    }

    const headcount = Number(body.headcount);
    if (!Number.isInteger(headcount) || headcount < 1 || headcount > MAX_HEADCOUNT) {
      return NextResponse.json(
        { error: `headcount must be a whole number between 1 and ${MAX_HEADCOUNT}` },
        { status: 400 },
      );
    }

    const created = await prisma.hiringRequest.create({
      data: {
        department,
        subDepartment: subDepartment || null,
        position,
        headcount,
        // The one facility this session writes to — resolved from the session, not the body.
        facility: scope.active,
        reqType,
        justification,
        requestedBy: session.supervisorName,
        // Calendar date — no timezone shift.
        expectedJoiningDate: parseISTDate(expected),
        // Entry point of the two-step flow; never settable by the client.
        status: 'Pending Manager',
      },
      select: { id: true, facility: true, status: true, headcount: true },
    });

    return NextResponse.json({
      success: true,
      request: {
        id: created.id,
        facility: created.facility,
        status: created.status,
        headcount: created.headcount,
        expected_joining_date: expected,
      },
    });
  } catch (error) {
    console.error('POST /api/hiring/request error:', error);
    return NextResponse.json({ error: 'Failed to create hiring request' }, { status: 500 });
  }
}
