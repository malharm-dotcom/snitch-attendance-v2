import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseISTDate } from '@/lib/ist';
import { isSouth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const facility = searchParams.get('facility') ?? '';
    const department = searchParams.get('department') ?? '';
    const attendance_date = searchParams.get('attendance_date') ?? '';
    const shift = searchParams.get('shift') ?? '';

    if (!facility || !department || !attendance_date) {
      return NextResponse.json({ error: 'facility, department, and attendance_date are required' }, { status: 400 });
    }

    const parsedDate = parseISTDate(attendance_date);
    const facilityFilter = isSouth(facility) ? { in: ['WH1', 'WH2'] } : { equals: facility };

    const header = await prisma.attendanceHeader.findFirst({
      where: {
        facility: facilityFilter,
        department,
        attendanceDate: parsedDate,
        ...(shift ? { shift } : {}),
      },
      orderBy: { id: 'desc' },
    });

    if (!header) {
      return NextResponse.json({
        submitted: false,
        marked_by: null,
        marked_at: null,
        request_status: null,
        shift: null,
      });
    }

    const rewriteReq = await prisma.attendanceRewriteRequest.findFirst({
      where: {
        facility: facilityFilter,
        department,
        attendanceDate: parsedDate,
      },
      orderBy: { id: 'desc' },
    });

    return NextResponse.json({
      submitted: true,
      marked_by: header.markedBy,
      marked_at: header.markedAt,
      request_status: rewriteReq?.requestStatus ?? null,
      shift: header.shift,
    });
  } catch (error) {
    console.error('GET /api/attendance/check error:', error);
    return NextResponse.json({ error: 'Failed to check submission' }, { status: 500 });
  }
}
