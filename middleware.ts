import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import type { SessionData } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protectedRoutes = ['/supervisor', '/manager', '/admin'];
  if (!protectedRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error('SESSION_SECRET environment variable is not set');
    return NextResponse.redirect(new URL('/', request.url));
  }

  const sessionOptions = {
    password: secret,
    cookieName: 'snitch_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    },
  };

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.isLoggedIn) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('expired', '1');
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/supervisor') && session.role !== 'supervisor') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (pathname.startsWith('/manager') && session.role !== 'manager') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/supervisor/:path*', '/manager/:path*', '/admin/:path*'],
};
