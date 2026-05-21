import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, isSouth } from '@/lib/auth';

async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const facilityFilter = isSouth(session.facility)
      ? { in: ['WH1', 'WH2'] }
      : { equals: session.facility };

    const employees = await prisma.employee.findMany({
      where: { facility: facilityFilter },
      orderBy: [{ facility: 'asc' }, { department: 'asc' }, { employeeName: 'asc' }],
      select: {
        id: true,
        employeeCode: true,
        employeeName: true,
        facility: true,
        department: true,
        shift: true,
        designation: true,
        reportingManager: true,
        rollType: true,
        gender: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      employees,
      currentFacility: session.facility,
      isSouthAdmin: isSouth(session.facility),
    });
  } catch (error) {
    console.error('GET /api/admin/employees error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { employee_code, employee_name, facility, department, designation, shift, is_active, roll_type, gender, reporting_manager } = body;

    if (!employee_code) return NextResponse.json({ error: 'employee_code required' }, { status: 400 });

    const target = await prisma.employee.findUnique({ where: { employeeCode: employee_code } });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const targetInScope = isSouth(session.facility)
      ? isSouth(target.facility)
      : target.facility === session.facility;

    if (!targetInScope) return NextResponse.json({ error: 'Cannot edit employees from another facility' }, { status: 403 });

    const updateData: Record<string, unknown> = {};
    if (employee_name !== undefined) updateData.employeeName = employee_name;
    if (facility !== undefined) {
      const newFacilityInScope = isSouth(session.facility)
        ? ['WH1', 'WH2'].includes(facility)
        : facility === session.facility;
      if (newFacilityInScope) updateData.facility = facility;
    }
    if (department !== undefined) updateData.department = department;
    if (designation !== undefined) updateData.designation = designation || null;
    if (shift !== undefined) updateData.shift = shift || null;
    if (is_active !== undefined) updateData.isActive = is_active;
    if (roll_type !== undefined) updateData.rollType = roll_type || null;
    if (gender !== undefined) updateData.gender = gender || null;
    if (reporting_manager !== undefined) updateData.reportingManager = reporting_manager || null;

    await prisma.employee.update({ where: { employeeCode: employee_code }, data: updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/admin/employees error:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}
