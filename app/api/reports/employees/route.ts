import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isSouth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const facility = searchParams.get('facility') ?? '';

    const south = facility ? isSouth(facility) : false;

    const facilityFilter = facility
      ? south
        ? { in: ['WH1', 'WH2'] }
        : { equals: facility }
      : undefined;

    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        ...(facilityFilter ? { facility: facilityFilter } : {}),
      },
      orderBy: [{ facility: 'asc' }, { department: 'asc' }, { employeeName: 'asc' }],
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('GET /api/reports/employees error:', error);
    return NextResponse.json({ error: 'Failed to fetch employee report' }, { status: 500 });
  }
}
