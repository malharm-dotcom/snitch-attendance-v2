import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { istNow, parseISTDate } from '@/lib/ist';
import { ATTENDANCE_CUTOFF_HOUR_IST } from '@/lib/constants';

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

    const nowIST = new Date(Date.now() + 5.5 * 3600000);
    const todayIST = nowIST.toISOString().slice(0, 10);

    if (attendance_date < todayIST) {
      // Allow resubmission if a rewrite request has been approved for this date
      const approvedRewrite = await prisma.attendanceRewriteRequest.findFirst({
        where: {
          attendanceDate: parseISTDate(attendance_date),
          facility,
          department,
          requestStatus: 'approved',
        },
      });
      if (!approvedRewrite) {
        return NextResponse.json(
          { error: 'Past date submissions must go through rewrite requests' },
          { status: 403 },
        );
      }
    }

    if (nowIST.getUTCHours() >= ATTENDANCE_CUTOFF_HOUR_IST) {
      return NextResponse.json(
        { error: 'Attendance submission is closed for today. Contact your manager.' },
        { status: 403 },
      );
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
