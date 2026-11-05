import 'server-only';
import type { AuthContext } from './session';
import { createSession, revokeAllSessions } from './session';
import { hashPassword, verifyPassword } from './password';
import { makeChangePasswordServerSchema } from './password-strength';
import { checkRateLimit, PASSWORD_CHANGE_RATE_LIMIT, recordFailure } from './rate-limit';
import { recordAudit, type RequestMeta } from '../audit';
import { getDb } from '../db';
import { toFieldErrors, type FieldErrors } from '@/lib/validation/auth';

export type ChangePasswordResult =
  | { ok: true; token: string; expiresAt: Date; otherSessionsEnded: number }
  | { ok: false; fieldErrors?: FieldErrors; message?: string };

/**
 * Changes the signed-in admin's own password.
 *
 * Every existing session of the account — on every device — is ended, and a
 * fresh session is issued for the browser that made the change. Rotating the
 * current session too means a token stolen before the change is worthless
 * after it.
 */
export async function changePassword(
  ctx: AuthContext,
  raw: { currentPassword: unknown; newPassword: unknown; confirmPassword: unknown },
  request: RequestMeta | null,
  now: Date = new Date(),
): Promise<ChangePasswordResult> {
  const db = getDb();
  const { admin } = ctx;

  const parsed = await makeChangePasswordServerSchema({ name: admin.name, email: admin.email }).safeParseAsync(raw);
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) };

  // A stolen session must not become a way to brute-force the current password.
  const rule = { key: `password-change:${admin.id}`, ...PASSWORD_CHANGE_RATE_LIMIT };
  const limit = await checkRateLimit([rule], now);
  if (limit.limited) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60000));
    return { ok: false, message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` };
  }

  const account = await db.adminUser.findUnique({ where: { id: admin.id }, omit: { passwordHash: false } });
  if (!account || !(await verifyPassword(account.passwordHash, parsed.data.currentPassword))) {
    await recordFailure([rule], now);
    return { ok: false, fieldErrors: { currentPassword: ['Your current password is incorrect.'] } };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  return db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: admin.id }, data: { passwordHash }, select: { id: true } });
    const ended = await revokeAllSessions(tx, admin.id);
    const session = await createSession(tx, admin.id, request, now);
    const otherSessionsEnded = Math.max(0, ended - 1);
    await recordAudit(tx, {
      action: 'PASSWORD_CHANGED',
      actorId: admin.id,
      targetType: 'admin_user',
      targetId: admin.id,
      metadata: { otherSessionsEnded },
      request,
    });
    return { ok: true as const, token: session.token, expiresAt: session.expiresAt, otherSessionsEnded };
  });
}
