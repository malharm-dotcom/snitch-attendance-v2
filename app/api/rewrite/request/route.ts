import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { istNow, parseISTDate } from '@/lib/ist';
import { getSession } from '@/lib/auth';
import { requireWriteFacility } from '@/lib/facilityScope';

interface RewriteRequestBody {
  attendance_date: string;
  /** Optional. Validated against the session's allowed set; never widens scope. */
  facility?: string;
  department: string;
  supervisor_name: string;
  reason: string;
  employee_codes: string[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RewriteRequestBody = await request.json();
    const { attendance_date, department, supervisor_name, reason, employee_codes } = body;

    // A rewrite request is scoped to one concrete facility, constrained server-side to
    // the session's allowed set (same rule as attendance/submit).
    const write = requireWriteFacility(session, body.facility);
    if ('error' in write) {
      return NextResponse.json({ error: write.error }, { status: 403 });
    }
    const facility = write.facility;

    if (!attendance_date || !department || !supervisor_name || !reason) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (!Array.isArray(employee_codes) || employee_codes.length === 0) {
      return NextResponse.json({ error: 'At least one employee_code is required' }, { status: 400 });
    }

    const parsedDate = parseISTDate(attendance_date);
    const requestedAt = istNow();

    // Duplicate/pending guard: never create a second pending request for the same
    // (employee, date, facility, department). Skip codes that already have one pending.
    const existingPending = await prisma.attendanceRewriteRequest.findMany({
      where: {
        attendanceDate: parsedDate,
        facility,
        department,
        employeeCode: { in: employee_codes },
        requestStatus: 'pending',
      },
      select: { employeeCode: true },
    });
    const alreadyPending = new Set(existingPending.map((r) => r.employeeCode));
    const codesToCreate = employee_codes.filter((code) => !alreadyPending.has(code));

    if (codesToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: employee_codes.length,
        message: 'A pending request already exists for the selected employee(s) and date.',
      });
    }

    await prisma.attendanceRewriteRequest.createMany({
      data: codesToCreate.map((code) => ({
        attendanceDate: parsedDate,
        facility,
        department,
        employeeCode: code,
        supervisorName: supervisor_name,
        reason,
        requestStatus: 'pending',
        requestedAt,
      })),
    });

    return NextResponse.json({
      success: true,
      created: codesToCreate.length,
      skipped: employee_codes.length - codesToCreate.length,
    });
  } catch (error) {
    console.error('POST /api/rewrite/request error:', error);
    return NextResponse.json({ error: 'Failed to create rewrite request' }, { status: 500 });
  }
}
