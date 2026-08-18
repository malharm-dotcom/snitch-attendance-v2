import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilityPrismaFilter } from '@/lib/facilityScope';
import { formatAttendanceDate } from '@/lib/ist';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scope = resolveFacilityScope(session);
    const facilityFilter = facilityPrismaFilter(scope);

    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        facility: facilityFilter,
      },
      orderBy: [{ facility: 'asc' }, { department: 'asc' }, { employeeName: 'asc' }],
    });

    return NextResponse.json({
      employees: employees.map((e) => ({
        ...e,
        joiningDate: e.joiningDate ? formatAttendanceDate(e.joiningDate) : null,
        exitDate: e.exitDate ? formatAttendanceDate(e.exitDate) : null,
      })),
      scope: scope.isAllSelected
        ? 'all'
        : scope.allowed.length > 1
          ? 'south'
          : scope.allowed[0].toLowerCase(),
    });
  } catch (error) {
    console.error('GET /api/reports/employees error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to fetch employee report' }, { status: 500 });
  }
}
