import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { FACILITIES } from '@/lib/constants';
import { ALL_FACILITIES, resolveFacilityScope } from '@/lib/facilityScope';

/**
 * Facility SELECTION endpoint for all-access users.
 *
 * This is NOT a client-trusted facility parameter: the client sends an intent, which the
 * server accepts only when (a) the session is authenticated, (b) the session carries the
 * server-side all_facilities capability, and (c) the value is a member of a fixed
 * whitelist. The selection is then persisted into the session. Every read path continues
 * to derive its scope from the session alone, via lib/facilityScope.ts.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session.allFacilities) {
      return NextResponse.json({ error: 'Your account is locked to a single facility' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const facility = typeof body?.facility === 'string' ? body.facility : '';

    if (facility !== ALL_FACILITIES && !FACILITIES.includes(facility)) {
      return NextResponse.json({ error: 'Unknown facility' }, { status: 400 });
    }

    session.selectedFacility = facility;
    await session.save();

    const scope = resolveFacilityScope(session);
    return NextResponse.json({
      success: true,
      selected: facility,
      scope: scope.label,
      canMark: scope.active !== null,
    });
  } catch (error) {
    console.error('POST /api/session/facility error:', error);
    return NextResponse.json({ error: 'Failed to switch facility' }, { status: 500 });
  }
}
