import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { istNow, parseISTDate } from '@/lib/ist';

interface EmployeeSubmit {
  employee_id?: number | null;
  employee_code: string;
  employee_name: string;
  attendance_status: string;
  remarks?: string;
}

interface SubmitBody {
  attendance_date: string;
  facility: string;
  department: string;
  marked_by: string;
  shift: string;
  employees: EmployeeSubmit[];
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitBody = await request.json();
    const { attendance_date, facility, department, marked_by, shift, employees } = body;

    if (!attendance_date || !facility || !department || !marked_by || !employees?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const markedAt = istNow();
    const parsedDate = parseISTDate(attendance_date);

    const header = await prisma.attendanceHeader.create({
      data: {
        attendanceDate: parsedDate,
        facility,
        department,
        markedBy: marked_by,
        markedAt,
        shift: shift || null,
        status: 'submitted',
      },
    });

    await prisma.attendanceDetail.createMany({
      data: employees.map((emp) => ({
        headerId: header.id,
        employeeId: emp.employee_id ?? null,
        employeeCode: emp.employee_code,
        employeeName: emp.employee_name,
        attendanceStatus: emp.attendance_status,
        remarks: emp.remarks ?? null,
        attendanceDate: parsedDate,
      })),
    });

    return NextResponse.json({ success: true, header_id: header.id });
  } catch (error) {
    console.error('POST /api/attendance/submit error:', error);
    return NextResponse.json({ error: 'Failed to submit attendance' }, { status: 500 });
  }
}
