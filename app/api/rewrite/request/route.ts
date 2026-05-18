import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { istNow, parseISTDate } from '@/lib/ist';

interface RewriteRequestBody {
  attendance_date: string;
  facility: string;
  department: string;
  supervisor_name: string;
  reason: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RewriteRequestBody = await request.json();
    const { attendance_date, facility, department, supervisor_name, reason } = body;

    if (!attendance_date || !facility || !department || !supervisor_name || !reason) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    await prisma.attendanceRewriteRequest.create({
      data: {
        attendanceDate: parseISTDate(attendance_date),
        facility,
        department,
        supervisorName: supervisor_name,
        reason,
        requestStatus: 'pending',
        requestedAt: istNow(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/rewrite/request error:', error);
    return NextResponse.json({ error: 'Failed to create rewrite request' }, { status: 500 });
  }
}
