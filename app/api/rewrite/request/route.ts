import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { istNow, parseISTDate } from '@/lib/ist';

interface RewriteRequestBody {
  attendance_date: string;
  facility: string;
  department: string;
  supervisor_name: string;
  reason: string;
  employee_codes: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: RewriteRequestBody = await request.json();
    const { attendance_date, facility, department, supervisor_name, reason, employee_codes } = body;

    if (!attendance_date || !facility || !department || !supervisor_name || !reason) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    if (!Array.isArray(employee_codes) || employee_codes.length === 0) {
      return NextResponse.json({ error: 'At least one employee_code is required' }, { status: 400 });
    }

    const parsedDate = parseISTDate(attendance_date);
    const requestedAt = istNow();

    await prisma.attendanceRewriteRequest.createMany({
      data: employee_codes.map((code) => ({
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/rewrite/request error:', error);
    return NextResponse.json({ error: 'Failed to create rewrite request' }, { status: 500 });
  }
}
