import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isSouth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const facility = searchParams.get('facility') ?? '';
    const department = searchParams.get('department') ?? '';
    const departments = searchParams.get('departments') ?? '';
    const shift = searchParams.get('shift') ?? '';

    const deptList = departments
      ? departments.split(',').map((d) => d.trim()).filter(Boolean)
      : department
        ? [department]
        : [];

    if (!facility || deptList.length === 0) {
      return NextResponse.json({ error: 'facility and department(s) are required' }, { status: 400 });
    }

    const facilityFilter = isSouth(facility)
      ? { in: ['WH1', 'WH2'] }
      : { equals: facility };

    const employees = await prisma.employee.findMany({
      where: {
        facility: facilityFilter,
        department: deptList.length === 1 ? deptList[0] : { in: deptList },
        isActive: true,
        ...(shift
          ? { OR: [{ shift }, { shift: null }] }
          : {}),
      },
      select: {
        id: true,
        employeeCode: true,
        employeeName: true,
        facility: true,
        department: true,
        shift: true,
      },
      orderBy: [{ department: 'asc' }, { employeeName: 'asc' }],
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('GET /api/employees error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
