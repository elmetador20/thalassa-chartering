import { getDb } from '@/lib/server/db';
import { approveAdmin, createAdmin } from '@/lib/server/auth/admins';
import { seedSuperAdmin } from '@/lib/server/auth/seed';
import { createSession, validateSession, type AuthContext } from '@/lib/server/auth/session';

// Strong test passwords. Two are the specification's own examples; none is a
// real credential anywhere.
export const PASSWORDS = {
  superAdmin: 'Harbour-Lantern-91-Quay!',
  admin: 'Nex!2026#SecureAdmin',
  other: 'IncWorx@Reports#82',
} as const;

export const SUPER = { name: 'Meera Iyer', email: 'super@incworx.test' };
export const REQUEST = { ipAddress: '203.0.113.10', userAgent: 'vitest' };

/** Empties every app table. The audit log is append-only, so its trigger is
 *  switched off for the reset — possible only for the table owner. */
export async function resetDatabase(): Promise<void> {
  const db = getDb();
  await db.$executeRawUnsafe('ALTER TABLE incworx.audit_logs DISABLE TRIGGER USER');
  await db.$executeRawUnsafe(
    'TRUNCATE incworx.audit_logs, incworx.admin_sessions, incworx.auth_attempts, incworx.reports, incworx.admin_invitations, incworx.access_requests, incworx.admin_users CASCADE',
  );
  await db.$executeRawUnsafe('ALTER TABLE incworx.audit_logs ENABLE TRIGGER USER');
}

/** A real, validated session context for an account. */
export async function contextFor(adminId: string): Promise<AuthContext> {
  const { token } = await createSession(getDb(), adminId, REQUEST);
  const ctx = await validateSession(token);
  if (!ctx) throw new Error('could not establish a session for the test account');
  return ctx;
}

export async function seedSuper(): Promise<AuthContext> {
  const result = await seedSuperAdmin({ ...SUPER, password: PASSWORDS.superAdmin });
  if (result.status !== 'created') throw new Error(`seed failed: ${result.status}`);
  return contextFor(result.adminId);
}

export async function addAdmin(
  superCtx: AuthContext,
  details: { name: string; email: string; password?: string },
  options: { approve?: boolean } = {},
): Promise<string> {
  const password = details.password ?? PASSWORDS.admin;
  const result = await createAdmin(superCtx, { ...details, password, confirmPassword: password }, REQUEST);
  if (!result.ok) throw new Error(`createAdmin failed: ${JSON.stringify(result.fieldErrors ?? result.message)}`);
  if (options.approve) await approveAdmin(superCtx, result.adminId, REQUEST);
  return result.adminId;
}
