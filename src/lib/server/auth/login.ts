import 'server-only';
import type { SessionAdmin } from './session';
import { createSession, revokeSessionByToken } from './session';
import { equaliseVerificationTime, hashPassword, passwordNeedsRehash, verifyPassword } from './password';
import { checkRateLimit, clearFailures, emailKey, ipKey, LOGIN_RATE_LIMITS, recordFailure } from './rate-limit';
import { recordAudit, type RequestMeta } from '../audit';
import { getDb } from '../db';
import { loginSchema } from '@/lib/validation/auth';

// ============================================================================
// Sign-in and sign-out.
//
// Order matters:
//   1. rate limit — before any hashing, so a locked key costs nothing;
//   2. password  — unknown e-mails still pay for a full verification, and
//                  both cases return the same generic answer, so neither
//                  timing nor wording reveals which e-mails exist;
//   3. account state — only AFTER the password is proven. Telling someone
//                  their account is pending or rejected is fine once they
//                  have shown they hold its password, never before.
// ============================================================================

export type LoginFailureReason = 'invalid_input' | 'invalid_credentials' | 'rate_limited' | 'pending' | 'rejected' | 'inactive';

export type LoginResult =
  | { ok: true; admin: SessionAdmin; token: string; expiresAt: Date }
  | { ok: false; reason: LoginFailureReason; retryAfterMs?: number };

export async function authenticate(
  raw: { email: unknown; password: unknown },
  request: RequestMeta | null,
  now: Date = new Date(),
): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid_input' };
  const { email, password } = parsed.data;

  const db = getDb();
  const rules = [
    { key: emailKey(email), ...LOGIN_RATE_LIMITS.perEmail },
    { key: ipKey(request?.ipAddress ?? null), ...LOGIN_RATE_LIMITS.perIp },
  ];

  const account = await db.adminUser.findUnique({ where: { email }, omit: { passwordHash: false } });
  const target = account ? { targetType: 'admin_user' as const, targetId: account.id } : {};

  const limit = await checkRateLimit(rules, now);
  if (limit.limited) {
    await recordAudit(db, { action: 'LOGIN_FAILED', ...target, metadata: { reason: 'rate_limited' }, request });
    return { ok: false, reason: 'rate_limited', retryAfterMs: limit.retryAfterMs };
  }

  let valid = false;
  if (account) {
    valid = await verifyPassword(account.passwordHash, password);
  } else {
    await equaliseVerificationTime(password);
  }

  if (!account || !valid) {
    await recordFailure(rules, now);
    await recordAudit(db, { action: 'LOGIN_FAILED', ...target, metadata: { reason: 'invalid_credentials' }, request });
    return { ok: false, reason: 'invalid_credentials' };
  }

  // Credentials are proven from here on.
  const blocked: LoginFailureReason | null =
    account.approvalStatus === 'PENDING'
      ? 'pending'
      : account.approvalStatus === 'REJECTED'
        ? 'rejected'
        : !account.isActive
          ? 'inactive'
          : null;
  if (blocked) {
    await recordAudit(db, { action: 'LOGIN_FAILED', ...target, metadata: { reason: blocked }, request });
    return { ok: false, reason: blocked };
  }

  // Upgrade the stored hash if the hashing parameters have been raised since.
  const upgradedHash = passwordNeedsRehash(account.passwordHash) ? await hashPassword(password) : null;

  await clearFailures(emailKey(email));
  const session = await db.$transaction(async (tx) => {
    const created = await createSession(tx, account.id, request, now);
    await tx.adminUser.update({
      where: { id: account.id },
      data: { lastLoginAt: now, ...(upgradedHash ? { passwordHash: upgradedHash } : {}) },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: 'LOGIN_SUCCEEDED',
      actorId: account.id,
      targetType: 'admin_user',
      targetId: account.id,
      request,
    });
    return created;
  });

  // Housekeeping: this account's long-expired sessions.
  await db.adminSession.deleteMany({ where: { adminUserId: account.id, expiresAt: { lte: now } } });

  return {
    ok: true,
    admin: { id: account.id, name: account.name, email: account.email, role: account.role },
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

/** Ends the session behind `token` and records who signed out. */
export async function signOut(token: string, request: RequestMeta | null): Promise<void> {
  const ended = await revokeSessionByToken(token);
  if (!ended) return;
  await recordAudit(getDb(), {
    action: 'LOGOUT',
    actorId: ended.adminUserId,
    targetType: 'admin_user',
    targetId: ended.adminUserId,
    request,
  });
}

/** User-facing wording for each refusal. Generic where it must be. */
export function loginFailureMessage(reason: LoginFailureReason, retryAfterMs = 0): string {
  switch (reason) {
    case 'pending':
      return 'Your account is awaiting Super Admin approval.';
    case 'rejected':
      return 'Your account access has been rejected. Contact the Super Admin.';
    case 'inactive':
      return 'Your account is inactive. Contact the Super Admin.';
    case 'rate_limited': {
      const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
      return `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
    }
    case 'invalid_input':
    case 'invalid_credentials':
    default:
      return 'Invalid email or password.';
  }
}
