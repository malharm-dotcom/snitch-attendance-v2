import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilityPrismaFilter } from '@/lib/facilityScope';
import { parseISTDate } from '@/lib/ist';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const department = searchParams.get('department') ?? '';
    const departments = searchParams.get('departments') ?? '';
    const shift = searchParams.get('shift') ?? '';
    const date = searchParams.get('date') ?? '';

    const deptList = departments
      ? departments.split(',').map((d) => d.trim()).filter(Boolean)
      : department
        ? [department]
        : [];

    if (deptList.length === 0) {
      return NextResponse.json({ error: 'department(s) are required' }, { status: 400 });
    }

    // Facility is resolved server-side from the session — never accepted from the client.
    const facilityFilter = facilityPrismaFilter(resolveFacilityScope(session));

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
        designation: true,
      },
      orderBy: [{ department: 'asc' }, { employeeName: 'asc' }],
    });

    // Build existing-status map from the most recent AttendanceHeader for this date/facility/dept/shift.
    // Headers are ordered newest-first; first occurrence of each employee_code wins.
    const statusMap = new Map<string, { status: string; remarks: string | null }>();
    if (date) {
      const parsedDate = parseISTDate(date);
      const headers = await prisma.attendanceHeader.findMany({
        where: {
          facility: facilityFilter,
          department: deptList.length === 1 ? deptList[0] : { in: deptList },
          attendanceDate: parsedDate,
          ...(shift ? { shift } : {}),
        },
        orderBy: { markedAt: 'desc' },
        include: {
          details: {
            select: {
              employeeCode: true,
              attendanceStatus: true,
              remarks: true,
            },
          },
        },
      });

      for (const header of headers) {
        for (const detail of header.details) {
          if (!statusMap.has(detail.employeeCode)) {
            statusMap.set(detail.employeeCode, {
              status: detail.attendanceStatus,
              remarks: detail.remarks ?? null,
            });
          }
        }
      }
    }

    return NextResponse.json({
      employees: employees.map((e) => {
        const existing = statusMap.get(e.employeeCode);
        return {
          id: e.id,
          employee_code: e.employeeCode,
          employee_name: e.employeeName,
          facility: e.facility,
          department: e.department,
          shift: e.shift,
          designation: e.designation,
          existing_status: existing?.status ?? null,
          existing_remarks: existing?.remarks ?? null,
        };
      }),
    });
  } catch (error) {
    console.error('GET /api/employees error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
