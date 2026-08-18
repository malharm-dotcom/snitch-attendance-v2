import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  supervisorName: string;
  facility: string;
  department: string;
  departments: string[];
  role: 'supervisor' | 'manager' | 'admin';
  isLoggedIn: boolean;
  /**
   * Per-user capability (supervisors.all_facilities) — orthogonal to role. When true the
   * user may switch which facility their session is scoped to. Optional so cookies issued
   * before this field existed still deserialize (undefined => not all-access => unchanged).
   */
  allFacilities?: boolean;
  /**
   * The facility an all-access user currently has selected, or ALL_FACILITIES. Meaningless
   * (and ignored) when allFacilities is false. Resolved via lib/facilityScope.ts — never
   * read directly by a route.
   */
  selectedFacility?: string;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const secret = process.env.SESSION_SECRET;
  console.log('SESSION_SECRET set:', !!secret);
  if (!secret || secret.length < 32) {
    throw new Error(
      `SESSION_SECRET must be at least 32 characters (got ${secret?.length ?? 0}). Set it in your environment variables.`
    );
  }
  const session = await getIronSession<SessionData>(cookies(), {
    password: secret,
    cookieName: 'snitch_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 60 * 60 * 12,
    },
  });
  return session;
}

// The South rule now lives with the rest of the facility-scoping logic; re-exported here
// so 'isSouth' keeps its historical import path.
export { isSouth } from './facilityScope';
