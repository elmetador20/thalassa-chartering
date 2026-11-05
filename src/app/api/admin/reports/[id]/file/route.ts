import { NextResponse, type NextRequest } from 'next/server';
import { LOGIN_PATH } from '@/lib/auth/constants';
import { fileErrorResponse, jsonError, jsonOk, readDisposition, redirectTo, routeSession, wantsJson } from '@/lib/server/http';
import { createAdminFileUrl } from '@/lib/server/reports/service';

// A signed-in admin's view of any report's PDF — drafts and archived
// included. Issues a short-lived signed link; the bucket itself stays private.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await routeSession(request);
  if (!session) {
    if (wantsJson(request)) return jsonError(401, 'unauthenticated', 'Your session has ended. Sign in again.');
    const login = new URL(LOGIN_PATH, request.nextUrl);
    login.searchParams.set('next', '/admin/reports');
    return NextResponse.redirect(login, 303);
  }

  try {
    const link = await createAdminFileUrl(session, params.id, readDisposition(request));
    return wantsJson(request) ? jsonOk({ url: link.url, expiresAt: link.expiresAt.toISOString() }) : redirectTo(link.url);
  } catch (error) {
    return fileErrorResponse(error, 'admin report file', request, { href: '/admin/reports', label: '← All reports' });
  }
}
