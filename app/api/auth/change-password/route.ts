import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { current_password, new_password } = await request.json();

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'Both current and new password are required' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    const supervisor = await prisma.supervisor.findFirst({
      where: { supervisorName: session.supervisorName, isActive: true },
    });

    if (!supervisor) {
      return NextResponse.json({ error: 'Supervisor not found' }, { status: 404 });
    }

    let valid = false;
    if (supervisor.passwordHash) {
      valid = await bcrypt.compare(current_password, supervisor.passwordHash);
    } else {
      valid = current_password === supervisor.pin;
    }

    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(new_password, 10);
    await prisma.supervisor.update({
      where: { id: supervisor.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/auth/change-password error:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
