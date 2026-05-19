import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') return null;
  return session;
}

export async function GET() {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supervisors = await prisma.supervisor.findMany({
      orderBy: [{ facility: 'asc' }, { supervisorName: 'asc' }],
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

    return NextResponse.json({ supervisors });
  } catch (error) {
    console.error('GET /api/admin/supervisors error:', error);
    return NextResponse.json({ error: 'Failed to fetch supervisors' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { supervisor_name, employee_code, facility, department, departments, role, password } = await request.json();

    if (!supervisor_name || !facility || !department || !role || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const supervisor = await prisma.supervisor.create({
      data: {
        supervisorName: supervisor_name,
        employeeCode: employee_code || null,
        facility,
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

export async function PUT(request: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { id, supervisor_name, employee_code, facility, department, departments, role, is_active, new_password } = body;

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (supervisor_name !== undefined) updateData.supervisorName = supervisor_name;
    if (employee_code !== undefined) updateData.employeeCode = employee_code || null;
    if (facility !== undefined) updateData.facility = facility;
    if (department !== undefined) updateData.department = department;
    if (departments !== undefined) updateData.departments = departments;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.isActive = is_active;
    if (new_password) updateData.passwordHash = await bcrypt.hash(new_password, 10);

    await prisma.supervisor.update({ where: { id }, data: updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/admin/supervisors error:', error);
    return NextResponse.json({ error: 'Failed to update supervisor' }, { status: 500 });
  }
}
