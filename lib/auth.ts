import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  supervisorName: string;
  facility: string;
  department: string;
  departments: string[];
  role: 'supervisor' | 'manager' | 'admin';
  isLoggedIn: boolean;
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

export function isSouth(facility: string): boolean {
  return facility === 'WH1' || facility === 'WH2';
}
