'use server';

import { redirect } from 'next/navigation';
import { LOGIN_PATH, safeAdminRedirect } from '@/lib/auth/constants';
import { can } from '@/lib/auth/permissions';
import { readFormFields, type FormState } from '@/lib/forms';
import { loginSchema, toFieldErrors } from '@/lib/validation/auth';
import { changePassword } from '@/lib/server/auth/account';
import {
  clearSessionCookie,
  currentSessionToken,
  getRequestMeta,
  requireActionSession,
  setSessionCookie,
} from '@/lib/server/auth/guards';
import { authenticate, loginFailureMessage, signOut } from '@/lib/server/auth/login';
import { revokeSessionByToken } from '@/lib/server/auth/session';

// Every export here is a public endpoint. Next.js rejects server-action POSTs
// whose Origin does not match the host (CSRF), and the session cookie is
// SameSite=Strict, so a cross-site page can neither call these nor ride a
// signed-in admin's session.

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const raw = readFormFields(formData, ['email', 'password', 'next']);
  const values = { email: raw.email.trim() };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values };

  const result = await authenticate(parsed.data, getRequestMeta());
  if (!result.ok) {
    return { status: 'error', message: loginFailureMessage(result.reason, result.retryAfterMs), values };
  }

  // Whatever session this browser held before is ended, so a planted or stale
  // cookie can never become an authenticated one (session fixation).
  const previous = currentSessionToken();
  if (previous) await revokeSessionByToken(previous);

  setSessionCookie(result.token, result.expiresAt);
  redirect(safeAdminRedirect(raw.next));
}

export async function logoutAction(): Promise<void> {
  const token = currentSessionToken();
  if (token) await signOut(token, getRequestMeta());
  clearSessionCookie();
  redirect(LOGIN_PATH);
}

export async function changePasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireActionSession();
  if (!can(ctx.admin.role, 'account:manage')) {
    return { status: 'error', message: 'You do not have permission to do that.' };
  }

  const raw = readFormFields(formData, ['currentPassword', 'newPassword', 'confirmPassword']);
  const result = await changePassword(ctx, raw, getRequestMeta());
  if (!result.ok) return { status: 'error', fieldErrors: result.fieldErrors, message: result.message };

  setSessionCookie(result.token, result.expiresAt);
  const others = result.otherSessionsEnded;
  return {
    status: 'success',
    message:
      others > 0
        ? `Password changed. You were signed out on ${others} other device${others === 1 ? '' : 's'}.`
        : 'Password changed.',
  };
}
