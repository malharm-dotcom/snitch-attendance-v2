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
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set. Cannot create session.');
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
