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

export const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'snitch_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 12, // 12 hours
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  return session;
}

export function isSouth(facility: string): boolean {
  return facility === 'WH1' || facility === 'WH2';
}
