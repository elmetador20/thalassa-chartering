import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { AdminRole } from '@/generated/prisma/client';
import { getDb, type DbTx } from '../db';
import type { RequestMeta } from '../audit';

// ============================================================================
// Database-backed sessions.
//
// The cookie holds a random 256-bit token; the database stores only its
// SHA-256. Every request re-reads the session AND the account it belongs to,
// so deactivating, rejecting or changing a password takes effect on the very
// next request — there is no signed token that stays valid until it expires.
// ============================================================================

/** Hard limit from sign-in, never extended. */
export const SESSION_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
/** Signed out after this long without a request. */
export const SESSION_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
/** `last_seen_at` is written at most this often, not on every request. */
const TOUCH_INTERVAL_MS = 60 * 1000;

export interface SessionAdmin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

export interface AuthContext {
  sessionId: string;
  admin: SessionAdmin;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Base64url of 32 bytes is exactly 43 characters; reject anything else
 *  before touching the database. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export async function createSession(
  db: DbTx,
  adminUserId: string,
  request: RequestMeta | null,
  now: Date = new Date(),
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);
  const session = await db.adminSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      adminUserId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      ipAddress: request?.ipAddress ?? null,
      userAgent: request?.userAgent ?? null,
    },
    select: { id: true },
  });
  return { token, sessionId: session.id, expiresAt };
}

/**
 * The signed-in admin for a cookie token, or null. Null for: unknown token,
 * absolute expiry, idle timeout, or an account that is no longer approved and
 * active. Dead sessions are deleted on sight.
 */
export async function validateSession(token: string | undefined, now: Date = new Date()): Promise<AuthContext | null> {
  if (!token || !TOKEN_SHAPE.test(token)) return null;

  const db = getDb();
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      adminUser: {
        select: { id: true, name: true, email: true, role: true, isActive: true, approvalStatus: true },
      },
    },
  });
  if (!session) return null;

  const expired = session.expiresAt.getTime() <= now.getTime();
  const idle = now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_TTL_MS;
  const { adminUser } = session;
  const allowed = adminUser.isActive && adminUser.approvalStatus === 'APPROVED';

  if (expired || idle || !allowed) {
    await db.adminSession.deleteMany({ where: { id: session.id } });
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.adminSession.updateMany({ where: { id: session.id }, data: { lastSeenAt: now } });
  }

  return {
    sessionId: session.id,
    admin: { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: adminUser.role },
  };
}

/** Sign-out: removes the one session the token belongs to. */
export async function revokeSessionByToken(token: string): Promise<{ adminUserId: string } | null> {
  if (!TOKEN_SHAPE.test(token)) return null;
  const db = getDb();
  const tokenHash = hashSessionToken(token);
  const session = await db.adminSession.findUnique({ where: { tokenHash }, select: { adminUserId: true } });
  if (!session) return null;
  await db.adminSession.deleteMany({ where: { tokenHash } });
  return session;
}

/** Ends every session of an account, optionally keeping one. */
export async function revokeAllSessions(db: DbTx, adminUserId: string, exceptSessionId?: string): Promise<number> {
  const { count } = await db.adminSession.deleteMany({
    where: { adminUserId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
  return count;
}
