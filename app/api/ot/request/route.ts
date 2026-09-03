import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseISTDate } from '@/lib/ist';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope } from '@/lib/facilityScope';

interface OtRequestBody {
  employee_code: string;
  ot_date: string;
  ot_hours: number | string;
  reason: string;
  /**
   * Never trusted. Present only so a spoof is REJECTED loudly rather than silently
   * ignored — the stored facility always comes from the employee's own row.
   */
  facility?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: OtRequestBody = await request.json();
    const employeeCode = (body.employee_code ?? '').trim();
    const reason = (body.reason ?? '').trim();
    const otDate = (body.ot_date ?? '').trim();

    // --- facility: resolved SERVER-SIDE, never from the client -----------------
    const scope = resolveFacilityScope(session);
    if (!scope.active) {
      // All-access user sitting on the "All facilities" aggregate: no concrete facility
      // to stamp, so the write cannot be resolved.
      return NextResponse.json(
        { error: 'Select a specific facility before raising OT. "All facilities" is read-only.' },
        { status: 400 },
      );
    }
    if (body.facility !== undefined && !scope.allowed.includes(body.facility)) {
      return NextResponse.json(
        { error: `Facility '${body.facility}' is outside your allowed scope (${scope.allowed.join(', ')})` },
        { status: 403 },
      );
    }

    // --- field validation (trust boundary — the DB CHECKs are the second line) --
    if (!employeeCode || !otDate || !reason) {
      return NextResponse.json({ error: 'employee_code, ot_date, ot_hours and reason are required' }, { status: 400 });
    }
    if (!DATE_RE.test(otDate)) {
      return NextResponse.json({ error: 'ot_date must be YYYY-MM-DD' }, { status: 400 });
    }

    const otHours = Number(body.ot_hours);
    if (!Number.isFinite(otHours) || otHours <= 0 || otHours > 24) {
      return NextResponse.json({ error: 'ot_hours must be between 0.5 and 24' }, { status: 400 });
    }
    if (Math.round(otHours * 2) !== otHours * 2) {
      return NextResponse.json({ error: 'ot_hours must be in steps of 0.5' }, { status: 400 });
    }

    // --- the employee must be inside the session's readable scope ---------------
    const employee = await prisma.employee.findUnique({
      where: { employeeCode },
      select: { employeeCode: true, facility: true, isActive: true },
    });
    if (!employee) {
      return NextResponse.json({ error: `Unknown employee_code '${employeeCode}'` }, { status: 400 });
    }
    if (!scope.allowed.includes(employee.facility)) {
      return NextResponse.json({ error: 'Employee is outside your facility scope' }, { status: 403 });
    }

    // Stamped from the EMPLOYEE's own row, not from the session's selected facility:
    // a South supervisor sees WH1 + WH2 together, and each OT row must carry the
    // facility the employee actually belongs to (same rule attendance/submit uses).
    const facility = employee.facility;

    const created = await prisma.otRequest.create({
      data: {
        employeeCode,
        facility,
        otDate: parseISTDate(otDate),   // calendar date — no timezone shift
        otHours,
        reason,
        status: 'Pending',
        requestedBy: session.supervisorName,
      },
      select: { id: true, facility: true, otDate: true, otHours: true, status: true },
    });

    return NextResponse.json({
      success: true,
      request: {
        id: created.id,
        employee_code: employeeCode,
        facility: created.facility,
        ot_date: otDate,
        ot_hours: Number(created.otHours),
        status: created.status,
      },
    });
  } catch (error) {
    console.error('POST /api/ot/request error:', error);
    return NextResponse.json({ error: 'Failed to create OT request' }, { status: 500 });
  }
}
