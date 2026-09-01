import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveAllowedFacilities, facilityPrismaFilter, resolveFacilityScope } from '@/lib/facilityScope';
import { parseISTDate, formatAttendanceDate } from '@/lib/ist';

async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const scope = resolveFacilityScope(session);
    const facilityFilter = facilityPrismaFilter(scope);

    const employees = await prisma.employee.findMany({
      where: { facility: facilityFilter },
      orderBy: [{ facility: 'asc' }, { department: 'asc' }, { employeeName: 'asc' }],
      select: {
        id: true,
        employeeCode: true,
        employeeName: true,
        facility: true,
        department: true,
        shift: true,
        designation: true,
        reportingManager: true,
        rollType: true,
        gender: true,
        isActive: true,
        joiningDate: true,
        exitDate: true,
      },
    });

    return NextResponse.json({
      employees: employees.map((e) => ({
        ...e,
        joiningDate: e.joiningDate ? formatAttendanceDate(e.joiningDate) : null,
        exitDate: e.exitDate ? formatAttendanceDate(e.exitDate) : null,
      })),
      currentFacility: scope.active ?? session.facility,
      isSouthAdmin: scope.allowed.length > 1,
      allowedFacilities: scope.allowed,
    });
  } catch (error) {
    console.error('GET /api/admin/employees error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      employee_code, employee_name, facility, department, joining_date,
      shift, designation, reporting_manager, roll_type, gender,
    } = body;

    if (!employee_code?.trim())
      return NextResponse.json({ error: 'employee_code is required' }, { status: 400 });
    if (!employee_name?.trim())
      return NextResponse.json({ error: 'employee_name is required' }, { status: 400 });
    if (!facility)
      return NextResponse.json({ error: 'facility is required' }, { status: 400 });
    if (!department)
      return NextResponse.json({ error: 'department is required' }, { status: 400 });
    if (!joining_date)
      return NextResponse.json({ error: 'joining_date is required' }, { status: 400 });

    // Scope check
    const inScope = resolveAllowedFacilities(session).includes(facility);
    if (!inScope)
      return NextResponse.json({ error: 'facility is outside your allowed scope' }, { status: 403 });

    // Uniqueness — check across ALL employees, active or inactive
    const existing = await prisma.employee.findUnique({ where: { employeeCode: employee_code.trim() } });
    if (existing)
      return NextResponse.json({ error: `Employee code "${employee_code}" already exists` }, { status: 409 });

    await prisma.employee.create({
      data: {
        employeeCode: employee_code.trim(),
        employeeName: employee_name.trim(),
        facility,
        department,
        joiningDate: parseISTDate(joining_date),
        isActive: true,
        shift: shift || null,
        designation: designation || null,
        reportingManager: reporting_manager || null,
        rollType: roll_type || null,
        gender: gender || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/admin/employees error:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}

/**
 * Rename an employee_code (the real code arrives 4-5 days after joining, so the
 * employee is created under a TMP- placeholder and renamed later).
 *
 * attendance_detail.employee_code is a plain VARCHAR — there is NO database foreign
 * key to employees — so renaming only the employees row silently orphans every
 * attendance day already marked. Both tables (plus rewrite requests) move together
 * in one transaction.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { employee_code, new_employee_code } = await request.json();
    const oldCode = String(employee_code ?? '').trim();
    const newCode = String(new_employee_code ?? '').trim();

    if (!oldCode || !newCode) return NextResponse.json({ error: 'employee_code and new_employee_code are required' }, { status: 400 });
    if (oldCode === newCode) return NextResponse.json({ success: true, moved: 0 });

    const target = await prisma.employee.findUnique({ where: { employeeCode: oldCode }, select: { facility: true } });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!resolveAllowedFacilities(session).includes(target.facility))
      return NextResponse.json({ error: 'Cannot edit employees from another facility' }, { status: 403 });

    const clash = await prisma.employee.findUnique({ where: { employeeCode: newCode } });
    if (clash) return NextResponse.json({ error: `Employee code "${newCode}" already exists` }, { status: 409 });

    const moved = await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { employeeCode: oldCode }, data: { employeeCode: newCode } });
      const details = await tx.attendanceDetail.updateMany({
        where: { employeeCode: oldCode },
        data: { employeeCode: newCode },
      });
      await tx.attendanceRewriteRequest.updateMany({
        where: { employeeCode: oldCode },
        data: { employeeCode: newCode },
      });
      return details.count;
    });

    return NextResponse.json({ success: true, moved });
  } catch (error) {
    console.error('PATCH /api/admin/employees error:', error);
    return NextResponse.json({ error: 'Failed to change employee code' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const {
      employee_code, employee_name, facility, department, designation,
      shift, is_active, roll_type, gender, reporting_manager, exit_date,
    } = body;

    if (!employee_code) return NextResponse.json({ error: 'employee_code required' }, { status: 400 });

    const target = await prisma.employee.findUnique({
      where: { employeeCode: employee_code },
      select: { facility: true, joiningDate: true },
    });
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const allowedFacilities = resolveAllowedFacilities(session);
    const targetInScope = allowedFacilities.includes(target.facility);
    if (!targetInScope)
      return NextResponse.json({ error: 'Cannot edit employees from another facility' }, { status: 403 });

    const updateData: Record<string, unknown> = {};

    if (employee_name !== undefined) updateData.employeeName = employee_name;
    if (facility !== undefined) {
      if (allowedFacilities.includes(facility)) updateData.facility = facility;
    }
    if (department !== undefined) updateData.department = department;
    if (designation !== undefined) updateData.designation = designation || null;
    if (shift !== undefined) updateData.shift = shift || null;
    if (roll_type !== undefined) updateData.rollType = roll_type || null;
    if (gender !== undefined) updateData.gender = gender || null;
    if (reporting_manager !== undefined) updateData.reportingManager = reporting_manager || null;

    if (is_active !== undefined) {
      updateData.isActive = is_active;

      if (is_active === false) {
        // exit_date is mandatory when marking inactive
        if (!exit_date)
          return NextResponse.json({ error: 'exit_date is required when marking an employee inactive' }, { status: 400 });

        // Validate exit_date >= joining_date when joining_date is present
        if (target.joiningDate) {
          const exitDateObj = parseISTDate(exit_date);
          if (exitDateObj < target.joiningDate) {
            const joiningStr = formatAttendanceDate(target.joiningDate);
            return NextResponse.json(
              { error: `exit_date (${exit_date}) must be on or after joining_date (${joiningStr})` },
              { status: 400 },
            );
          }
        }

        updateData.exitDate = parseISTDate(exit_date);
      } else if (is_active === true) {
        // Reactivation: clear exit_date
        updateData.exitDate = null;
      }
    }

    await prisma.employee.update({ where: { employeeCode: employee_code }, data: updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT /api/admin/employees error:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}
