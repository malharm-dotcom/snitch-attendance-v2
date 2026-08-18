import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseISTDate } from '@/lib/ist';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, facilityPrismaFilter } from '@/lib/facilityScope';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const attendance_date = searchParams.get('attendance_date') ?? '';

    if (!attendance_date) {
      return NextResponse.json({ error: 'attendance_date is required' }, { status: 400 });
    }

    const parsedDate = parseISTDate(attendance_date);

    // Always an explicit whitelist — there is no unscoped path any more.
    const facilityFilter = facilityPrismaFilter(resolveFacilityScope(session));

    const headers = await prisma.attendanceHeader.findMany({
      where: {
        attendanceDate: parsedDate,
        facility: facilityFilter,
      },
      orderBy: [{ facility: 'asc' }, { department: 'asc' }, { markedAt: 'desc' }],
    });

    // Deduplicate: one row per facility+department combination (latest)
    const seen = new Set<string>();
    const submissions = headers
      .filter((h) => {
        const key = `${h.facility}|${h.department}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((h) => ({
        facility: h.facility,
        department: h.department,
        marked_by: h.markedBy,
        marked_at: h.markedAt,
        shift: h.shift,
      }));

    const deptCounts = await prisma.employee.groupBy({
      by: ['department'],
      where: {
        isActive: true,
        facility: facilityFilter,
      },
      _count: { _all: true },
    });

    return NextResponse.json({
      submissions,
      deptCounts: deptCounts.map((r) => ({ department: r.department, count: r._count._all })),
    });
  } catch (error) {
    console.error('GET /api/today-status error:', error);
    return NextResponse.json({ error: 'Failed to fetch today status' }, { status: 500 });
  }
}
