import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

interface EmployeeRow {
  employee_code: string;
  employee_name: string;
  facility: string;
  department: string;
  is_active: string;
  shift?: string;
  designation?: string;
  reporting_manager?: string;
  roll_type?: string;
  gender?: string;
}

function parseBool(val: string): boolean {
  return val?.toLowerCase() === 'true' || val === '1';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: { rows: EmployeeRow[] } = await request.json();
    const { rows } = body;

    if (!rows?.length) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const { isSouth } = await import('@/lib/auth');
    const allowedFacilities = isSouth(session.facility) ? ['WH1', 'WH2'] : [session.facility];

    let inserted = 0;
    let updated = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.employee_code || !row.employee_name || !row.facility || !row.department) {
        errors.push({ row: i + 1, error: 'Missing required fields (employee_code, employee_name, facility, department)' });
        continue;
      }
      if (!allowedFacilities.includes(row.facility)) {
        errors.push({ row: i + 1, error: `Facility '${row.facility}' is outside your allowed scope (${allowedFacilities.join(', ')})` });
        continue;
      }

      try {
        const existing = await prisma.employee.findUnique({
          where: { employeeCode: row.employee_code },
        });

        await prisma.employee.upsert({
          where: { employeeCode: row.employee_code },
          update: {
            employeeName: row.employee_name,
            facility: row.facility,
            department: row.department,
            isActive: parseBool(row.is_active),
            shift: row.shift || null,
            designation: row.designation || null,
            reportingManager: row.reporting_manager || null,
            rollType: row.roll_type || null,
            gender: row.gender || null,
          },
          create: {
            employeeCode: row.employee_code,
            employeeName: row.employee_name,
            facility: row.facility,
            department: row.department,
            isActive: parseBool(row.is_active),
            shift: row.shift || null,
            designation: row.designation || null,
            reportingManager: row.reporting_manager || null,
            rollType: row.roll_type || null,
            gender: row.gender || null,
          },
        });

        if (existing) updated++;
        else inserted++;
      } catch (err) {
        errors.push({ row: i + 1, error: String(err) });
      }
    }

    return NextResponse.json({ success: true, inserted, updated, errors });
  } catch (error) {
    console.error('POST /api/employees/bulk-upload error:', error);
    return NextResponse.json({ error: 'Bulk upload failed' }, { status: 500 });
  }
}
