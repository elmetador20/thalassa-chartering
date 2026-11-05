import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { LOGIN_PATH, SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import { can, type Permission } from '@/lib/auth/permissions';
import type { RequestMeta } from '../audit';
import { validateSession, type AuthContext } from './session';

// ============================================================================
// Request-level guards: the only place that reads the session cookie.
//
// These are the security boundary. The middleware's cookie-presence check is
// a fast redirect for the browser, nothing more: it cannot see the database,
// so it cannot know whether a session is still valid.
//
// Pages call requireAdminPage / requirePermissionPage themselves — not only
// the layout — because App Router layouts are not re-run on client-side
// navigation between pages, while pages are.
// ============================================================================

/** Client IP and user agent, bounded. On Vercel `x-real-ip` is set by the
 *  platform; behind another proxy, make sure it overwrites these headers. */
export function getRequestMeta(): RequestMeta {
  const h = headers();
  const ip = h.get('x-real-ip')?.trim() || h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  return {
    ipAddress: ip ? ip.slice(0, 64) : null,
    userAgent: h.get('user-agent')?.slice(0, 512) ?? null,
  };
}

function readSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE_NAME)?.value;
}

/** The signed-in admin for this request (validated once per render). */
export const getCurrentSession = cache(async (): Promise<AuthContext | null> => validateSession(readSessionToken()));

export async function requireAdminPage(): Promise<AuthContext> {
  const session = await getCurrentSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}

/** Authenticated but not permitted → 404, so a restricted page's existence
 *  is not advertised to roles that cannot use it. */
export async function requirePermissionPage(permission: Permission): Promise<AuthContext> {
  const session = await requireAdminPage();
  if (!can(session.admin.role, permission)) notFound();
  return session;
}

/**
 * For server actions. Re-validates against the database on every call —
 * never trusts state from an earlier render — and redirects to sign-in when
 * there is no valid session.
 */
export async function requireActionSession(): Promise<AuthContext> {
  const session = await validateSession(readSessionToken());
  if (!session) redirect(LOGIN_PATH);
  return session;
}

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export function setSessionCookie(token: string, expiresAt: Date): void {
  cookies().set(SESSION_COOKIE_NAME, token, { ...cookieBase, expires: expiresAt });
}

export function clearSessionCookie(): void {
  cookies().set(SESSION_COOKIE_NAME, '', { ...cookieBase, maxAge: 0 });
}

export function currentSessionToken(): string | undefined {
  return readSessionToken();
}
