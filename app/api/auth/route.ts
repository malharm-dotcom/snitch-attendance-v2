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

    const input = employee_code.trim();

    // Try employee_code first; if that column doesn't exist yet fall back to name lookup
    let supervisor = null;
    try {
      supervisor = await prisma.supervisor.findFirst({
        where: {
          OR: [
            { employeeCode: input },
            { supervisorName: { equals: input, mode: 'insensitive' } },
          ],
          isActive: true,
        },
      });
    } catch {
      // employee_code column not yet migrated — find by name only
      supervisor = await prisma.supervisor.findFirst({
        where: { supervisorName: { equals: input, mode: 'insensitive' }, isActive: true },
      });
    }

    // Also try case-insensitive contains if exact match found nothing (e.g. "Malhar" vs "MALHAR M")
    if (!supervisor) {
      try {
        supervisor = await prisma.supervisor.findFirst({
          where: {
            OR: [
              { employeeCode: input },
              { supervisorName: { contains: input, mode: 'insensitive' } },
            ],
            isActive: true,
          },
        });
      } catch {
        supervisor = await prisma.supervisor.findFirst({
          where: { supervisorName: { contains: input, mode: 'insensitive' }, isActive: true },
        });
      }
    }

    if (!supervisor) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Password check: bcrypt hash → then PIN fallback (pre-migration)
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
    // All-facility access is a per-user capability, not a role. Seed the selection with the
    // user's own facility so a concrete facility is always active (marking works immediately);
    // "All facilities" is only ever reached by an explicit switch.
    session.allFacilities = supervisor.allFacilities;
    session.selectedFacility = supervisor.allFacilities ? supervisor.facility : undefined;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({
      success: true,
      supervisor_name: supervisor.supervisorName,
      facility: supervisor.facility,
      department: supervisor.department,
      departments: session.departments,
      role: supervisor.role,
      all_facilities: supervisor.allFacilities,
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
