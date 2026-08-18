import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveAllowedFacilities, facilityPrismaFilter, resolveFacilityScope } from '@/lib/facilityScope';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') return null;
  return session;
}



export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // WH1/WH2 admins see both; North admins see North only; all-access sees their selection
    const scope = resolveFacilityScope(session);
    const supervisors = await prisma.supervisor.findMany({
      where: { facility: facilityPrismaFilter(scope) },
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
        allFacilities: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      supervisors,
      currentFacility: scope.active ?? session.facility,
      currentUser: session.supervisorName,
      isSouthAdmin: scope.allowed.length > 1,
      allowedFacilities: scope.allowed,
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

    const { supervisor_name, employee_code, facility, department, departments, role, password, all_facilities } = await request.json();

    if (!supervisor_name || !department || !role || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate the requested facility is within admin's allowed scope
    const requestedFacility = facility || resolveAllowedFacilities(session)[0];
    const allowed = resolveAllowedFacilities(session).includes(requestedFacility);

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
        allFacilities: all_facilities === true,
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

    const targetInScope = resolveAllowedFacilities(session).includes(target.facility);

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
    const { id, supervisor_name, employee_code, facility, department, departments, role, is_active, new_password, all_facilities } = body;

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    // Verify the target belongs to this admin's scope
    const target = await prisma.supervisor.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const allowedFacilities = resolveAllowedFacilities(session);
    const targetInScope = allowedFacilities.includes(target.facility);

    if (!targetInScope) return NextResponse.json({ error: 'Cannot edit supervisors from another facility' }, { status: 403 });
    if (target.role === 'manager') return NextResponse.json({ error: 'Manager accounts cannot be edited here' }, { status: 403 });
    if (target.supervisorName === session.supervisorName) return NextResponse.json({ error: 'Use "Change PIN" in the topbar to update your own credentials' }, { status: 403 });

    const updateData: Record<string, unknown> = {};
    if (supervisor_name !== undefined) updateData.supervisorName = supervisor_name;
    if (employee_code !== undefined) updateData.employeeCode = employee_code || null;
    if (facility !== undefined) {
      if (allowedFacilities.includes(facility)) updateData.facility = facility;
    }
    if (department !== undefined) updateData.department = department;
    if (departments !== undefined) updateData.departments = departments;
    if (role !== undefined && role !== 'manager') updateData.role = role;
    if (all_facilities !== undefined) updateData.allFacilities = all_facilities === true;
    if (is_active !== undefined) updateData.isActive = is_active;
    if (new_password) updateData.passwordHash = await bcrypt.hash(new_password, 10);

    await prisma.supervisor.update({ where: { id }, data: updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/admin/supervisors error:', error);
    return NextResponse.json({ error: 'Failed to update supervisor' }, { status: 500 });
  }
}
