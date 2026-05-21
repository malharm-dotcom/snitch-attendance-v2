import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, isSouth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') return null;
  return session;
}

function facilityFilter(facility: string) {
  return isSouth(facility) ? { in: ['WH1', 'WH2'] } : { equals: facility };
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // WH1/WH2 admins see both; North admins see North only
    const supervisors = await prisma.supervisor.findMany({
      where: { facility: facilityFilter(session.facility) },
      orderBy: [{ role: 'asc' }, { supervisorName: 'asc' }],
      select: {
        id: true,
        supervisorName: true,
        employeeCode: true,
        facility: true,
        department: true,
        departments: true,
        pin: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      supervisors,
      currentFacility: session.facility,
      currentUser: session.supervisorName,
      isSouthAdmin: isSouth(session.facility),
    });
  } catch (error) {
    console.error('GET /api/admin/supervisors error:', error);
    return NextResponse.json({ error: 'Failed to fetch supervisors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { supervisor_name, employee_code, facility, department, departments, role, password } = await request.json();

    if (!supervisor_name || !department || !role || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate the requested facility is within admin's allowed scope
    const requestedFacility = facility || session.facility;
    const allowed = isSouth(session.facility)
      ? ['WH1', 'WH2'].includes(requestedFacility)
      : requestedFacility === session.facility;

    if (!allowed) {
      return NextResponse.json({ error: 'Cannot add supervisor to another facility' }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const supervisor = await prisma.supervisor.create({
      data: {
        supervisorName: supervisor_name,
        employeeCode: employee_code || null,
        facility: requestedFacility,
        department,
        departments: departments?.length ? departments : [department],
        pin: '0000',
        passwordHash,
        role,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, id: supervisor.id });
  } catch (error) {
    console.error('POST /api/admin/supervisors error:', error);
    return NextResponse.json({ error: 'Failed to create supervisor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const target = await prisma.supervisor.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const targetInScope = isSouth(session.facility)
      ? isSouth(target.facility)
      : target.facility === session.facility;

    if (!targetInScope) return NextResponse.json({ error: 'Cannot delete supervisors from another facility' }, { status: 403 });
    if (target.role === 'manager') return NextResponse.json({ error: 'Manager accounts cannot be deleted here' }, { status: 403 });
    if (target.supervisorName === session.supervisorName) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 403 });

    await prisma.supervisor.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/supervisors error:', error);
    return NextResponse.json({ error: 'Failed to delete supervisor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { id, supervisor_name, employee_code, facility, department, departments, role, is_active, new_password } = body;

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    // Verify the target belongs to this admin's scope
    const target = await prisma.supervisor.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const targetInScope = isSouth(session.facility)
      ? isSouth(target.facility)
      : target.facility === session.facility;

    if (!targetInScope) return NextResponse.json({ error: 'Cannot edit supervisors from another facility' }, { status: 403 });
    if (target.role === 'manager') return NextResponse.json({ error: 'Manager accounts cannot be edited here' }, { status: 403 });
    if (target.supervisorName === session.supervisorName) return NextResponse.json({ error: 'Use "Change PIN" in the topbar to update your own credentials' }, { status: 403 });

    const updateData: Record<string, unknown> = {};
    if (supervisor_name !== undefined) updateData.supervisorName = supervisor_name;
    if (employee_code !== undefined) updateData.employeeCode = employee_code || null;
    if (facility !== undefined) {
      const newFacilityInScope = isSouth(session.facility) ? ['WH1', 'WH2'].includes(facility) : facility === session.facility;
      if (newFacilityInScope) updateData.facility = facility;
    }
    if (department !== undefined) updateData.department = department;
    if (departments !== undefined) updateData.departments = departments;
    if (role !== undefined && role !== 'manager') updateData.role = role;
    if (is_active !== undefined) updateData.isActive = is_active;
    if (new_password) updateData.passwordHash = await bcrypt.hash(new_password, 10);

    await prisma.supervisor.update({ where: { id }, data: updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/admin/supervisors error:', error);
    return NextResponse.json({ error: 'Failed to update supervisor' }, { status: 500 });
  }
}
