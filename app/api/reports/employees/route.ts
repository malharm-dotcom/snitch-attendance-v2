import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, isSouth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const south = isSouth(session.facility);
    const facilityFilter = south
      ? { in: ['WH1', 'WH2'] }
      : { equals: session.facility };

    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        facility: facilityFilter,
      },
      orderBy: [{ facility: 'asc' }, { department: 'asc' }, { employeeName: 'asc' }],
    });

    return NextResponse.json({ employees, scope: south ? 'south' : 'north' });
  } catch (error) {
    console.error('GET /api/reports/employees error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to fetch employee report' }, { status: 500 });
  }
}
