import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

interface AuthBody {
  employee_code: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AuthBody = await request.json();
    const { employee_code, password } = body;

    if (!employee_code || !password) {
      return NextResponse.json({ error: 'Employee code and password are required' }, { status: 400 });
    }

    const supervisor = await prisma.supervisor.findFirst({
      where: { employeeCode: employee_code, isActive: true },
    });

    if (!supervisor) {
      return NextResponse.json({ error: 'Invalid employee code or password' }, { status: 401 });
    }

    // If no password_hash yet (pre-migration), accept the PIN as fallback
    let valid = false;
    if (supervisor.passwordHash) {
      valid = await bcrypt.compare(password, supervisor.passwordHash);
    } else {
      valid = password === supervisor.pin;
    }

    if (!valid) {
      return NextResponse.json({ error: 'Invalid employee code or password' }, { status: 401 });
    }

    const session = await getSession();
    session.supervisorName = supervisor.supervisorName;
    session.facility = supervisor.facility;
    session.department = supervisor.department;
    session.departments = supervisor.departments.length > 0
      ? supervisor.departments
      : [supervisor.department];
    session.role = supervisor.role as 'supervisor' | 'manager' | 'admin';
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({
      success: true,
      supervisor_name: supervisor.supervisorName,
      facility: supervisor.facility,
      department: supervisor.department,
      departments: session.departments,
      role: supervisor.role,
    });
  } catch (error) {
    console.error('POST /api/auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    session.destroy();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/auth error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
