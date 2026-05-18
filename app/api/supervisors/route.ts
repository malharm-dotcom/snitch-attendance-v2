import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const role = request.nextUrl.searchParams.get('role');

    const where = role
      ? { role, isActive: true }
      : { isActive: true };

    const supervisors = await prisma.supervisor.findMany({
      where,
      select: { supervisorName: true },
      orderBy: { supervisorName: 'asc' },
    });

    return NextResponse.json({ supervisors: supervisors.map((s) => s.supervisorName) });
  } catch (error) {
    console.error('GET /api/supervisors error:', error);
    return NextResponse.json({ error: 'Failed to fetch supervisors' }, { status: 500 });
  }
}
