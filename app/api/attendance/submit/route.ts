import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseISTDate } from '@/lib/ist';
import { ATTENDANCE_CUTOFF_HOUR_IST } from '@/lib/constants';
import { getSession } from '@/lib/auth';
import { requireWriteFacility } from '@/lib/facilityScope';

interface EmployeeSubmit {
  employee_id?: number | null;
  employee_code: string;
  employee_name: string;
  attendance_status: string;
  remarks?: string;
}

interface SubmitBody {
  attendance_date: string;
  /** Optional. Validated against the session's allowed set; never widens scope. */
  facility?: string;
  department: string;
  marked_by: string;
  shift: string;
  employees: EmployeeSubmit[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SubmitBody = await request.json();
    const { attendance_date, department, marked_by, shift, employees } = body;

    // Writes always target ONE concrete facility. An all-access user viewing
    // "All facilities" has no write target and is blocked here, not just in the UI.
    // A named facility is honoured only if it is inside the session's allowed set —
    // that keeps a South supervisor's WH2 employees stamped WH2, as before.
    const write = requireWriteFacility(session, body.facility);
    if ('error' in write) {
      return NextResponse.json({ error: write.error }, { status: 403 });
    }
    const facility = write.facility;

    if (!attendance_date || !department || !marked_by || !employees?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const nowIST = new Date(Date.now() + 5.5 * 3600000);
    const todayIST = nowIST.toISOString().slice(0, 10);
    const isPastDate = attendance_date < todayIST;
    const parsedDate = parseISTDate(attendance_date);

    // Check whether a submission already exists for this combination
    const existingHeader = await prisma.attendanceHeader.findFirst({
      where: {
        attendanceDate: parsedDate,
        facility,
        department,
        ...(shift ? { shift } : {}),
      },
      select: { id: true },
    });

    // Find any approved rewrite request for this combination
    const approvedRewrite = await prisma.attendanceRewriteRequest.findFirst({
      where: {
        attendanceDate: parsedDate,
        facility,
        department,
        requestStatus: 'approved',
      },
      select: { id: true },
    });

    // Past-date guard: cannot submit to a past date without an approved rewrite
    if (isPastDate && !approvedRewrite) {
      return NextResponse.json(
        { error: 'Past date submissions must go through rewrite requests' },
        { status: 403 },
      );
    }

    // Existing-submission guard: cannot resubmit without an approved rewrite
    if (existingHeader && !approvedRewrite) {
      return NextResponse.json(
        { error: 'Attendance already submitted. Request a rewrite through the manager to make changes.' },
        { status: 403 },
      );
    }

    // Cutoff-hour guard
    if (nowIST.getUTCHours() >= ATTENDANCE_CUTOFF_HOUR_IST) {
      return NextResponse.json(
        { error: 'Attendance submission is closed for today. Contact your manager.' },
        { status: 403 },
      );
    }

    // All guards passed — create the submission
    // Use real UTC timestamp so formatIST(+5.5h) displays correct IST time
    const markedAt = new Date();

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

    // Consume the approved rewrite so it cannot authorise another overwrite
    if (approvedRewrite) {
      await prisma.attendanceRewriteRequest.update({
        where: { id: approvedRewrite.id },
        data: { requestStatus: 'used' },
      });
    }

    return NextResponse.json({ success: true, header_id: header.id });
  } catch (error) {
    console.error('POST /api/attendance/submit error:', error);
    return NextResponse.json({ error: 'Failed to submit attendance' }, { status: 500 });
  }
}
