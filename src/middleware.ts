import { NextResponse, type NextRequest } from 'next/server';
import { LOGIN_PATH, SESSION_COOKIE_NAME } from '@/lib/auth/constants';

// ============================================================================
// First line only — a fast redirect, never the security boundary.
//
// Runs on the Edge, where the database is out of reach, so all it can know is
// whether a session cookie is present. Real validation (token, expiry, idle
// timeout, account approved and active, role) happens on the server in every
// protected page and action — see src/lib/server/auth/guards.ts.
//
// Requires Next.js >= 14.2.25 (CVE-2025-29927, a middleware bypass); the
// project is on 14.2.35. Even on a vulnerable version, bypassing this file
// would gain nothing, because nothing behind it trusts it.
// ============================================================================

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === LOGIN_PATH) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
