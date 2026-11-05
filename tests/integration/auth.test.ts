import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/lib/server/db';
import { changePassword } from '@/lib/server/auth/account';
import { approveAdmin, rejectAdmin, setAdminActive } from '@/lib/server/auth/admins';
import { authenticate, signOut } from '@/lib/server/auth/login';
import { LOGIN_RATE_LIMITS } from '@/lib/server/auth/rate-limit';
import { seedSuperAdmin } from '@/lib/server/auth/seed';
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS, createSession, hashSessionToken, validateSession } from '@/lib/server/auth/session';
import { addAdmin, contextFor, PASSWORDS, REQUEST, resetDatabase, seedSuper, SUPER } from '../support/fixtures';

const db = () => getDb();
const ADMIN = { name: 'Ravi Kumar', email: 'ravi@incworx.test' };

beforeEach(resetDatabase);

describe('migrations', () => {
  it('left pre-existing data in public untouched', async () => {
    const rows = await db().$queryRawUnsafe<{ name: string }[]>('SELECT name FROM public.legacy_customers ORDER BY id');
    expect(rows.map((r) => r.name)).toEqual(['kept-1', 'kept-2', 'kept-3']);
  });

  it('gives the Supabase API roles no way into the app schema', async () => {
    const [access] = await db().$queryRawUnsafe<Record<string, boolean>[]>(`
      SELECT has_schema_privilege('anon', 'incworx', 'USAGE') AS anon_usage,
             has_schema_privilege('authenticated', 'incworx', 'USAGE') AS auth_usage,
             has_table_privilege('anon', 'incworx.admin_users', 'SELECT') AS anon_admins,
             has_table_privilege('anon', 'incworx.admin_sessions', 'SELECT') AS anon_sessions`);
    expect(Object.values(access).every((v) => v === false)).toBe(true);
  });
});

describe('Super Admin seed', () => {
  it('creates exactly one approved, active Super Admin with a hashed password', async () => {
    const result = await seedSuperAdmin({ ...SUPER, password: PASSWORDS.superAdmin });
    expect(result.status).toBe('created');

    const row = await db().adminUser.findUniqueOrThrow({ where: { email: SUPER.email }, omit: { passwordHash: false } });
    expect(row).toMatchObject({ role: 'SUPER_ADMIN', approvalStatus: 'APPROVED', isActive: true });
    expect(row.approvedAt).toBeInstanceOf(Date);
    expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(row.passwordHash).not.toContain(PASSWORDS.superAdmin);
  });

  it('is idempotent and never creates a second Super Admin', async () => {
    await seedSuperAdmin({ ...SUPER, password: PASSWORDS.superAdmin });
    const again = await seedSuperAdmin({ name: 'Another Person', email: 'other@incworx.test', password: PASSWORDS.other });
    expect(again.status).toBe('exists');
    expect(await db().adminUser.count({ where: { role: 'SUPER_ADMIN' } })).toBe(1);
  });

  it('never resets an existing Super Admin password', async () => {
    await seedSuperAdmin({ ...SUPER, password: PASSWORDS.superAdmin });
    await seedSuperAdmin({ ...SUPER, password: PASSWORDS.other });
    expect((await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, REQUEST)).ok).toBe(true);
  });

  it('survives concurrent runs: still one Super Admin', async () => {
    const results = await Promise.all([
      seedSuperAdmin({ ...SUPER, password: PASSWORDS.superAdmin }),
      seedSuperAdmin({ name: 'Other Person', email: 'other@incworx.test', password: PASSWORDS.other }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['created', 'exists']);
    expect(await db().adminUser.count({ where: { role: 'SUPER_ADMIN' } })).toBe(1);
  });

  it('validates the password with the strong schema', async () => {
    const result = await seedSuperAdmin({ ...SUPER, password: 'admin123' });
    expect(result.status).toBe('invalid');
    expect(await db().adminUser.count()).toBe(0);
  });

  it('refuses to promote an existing admin by e-mail', async () => {
    // Insert an ordinary admin directly (no Super Admin exists yet to create one).
    await db().adminUser.create({ data: { name: 'Ravi Kumar', email: 'ravi@incworx.test', passwordHash: 'x' } });
    const result = await seedSuperAdmin({ name: 'Ravi Kumar', email: 'ravi@incworx.test', password: PASSWORDS.superAdmin });
    expect(result.status).toBe('email_taken');
    expect((await db().adminUser.findUniqueOrThrow({ where: { email: 'ravi@incworx.test' } })).role).toBe('ADMIN');
  });
});

describe('sign-in', () => {
  it('signs the Super Admin in with the seeded credentials', async () => {
    await seedSuperAdmin({ ...SUPER, password: PASSWORDS.superAdmin });
    const result = await authenticate({ email: '  SUPER@incworx.TEST ', password: PASSWORDS.superAdmin }, REQUEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.admin.role).toBe('SUPER_ADMIN');
    expect(await validateSession(result.token)).toMatchObject({ admin: { email: SUPER.email } });

    const stored = await db().adminSession.findFirstOrThrow({ where: { adminUserId: result.admin.id } });
    expect(stored.tokenHash).toBe(hashSessionToken(result.token));
    expect(stored.tokenHash).not.toBe(result.token); // only the hash is stored
  });

  it('signs an approved, active admin in', async () => {
    const superCtx = await seedSuper();
    await addAdmin(superCtx, ADMIN, { approve: true });
    const result = await authenticate({ email: ADMIN.email, password: PASSWORDS.admin }, REQUEST);
    expect(result).toMatchObject({ ok: true, admin: { role: 'ADMIN' } });
    expect((await db().adminUser.findUniqueOrThrow({ where: { email: ADMIN.email } })).lastLoginAt).toBeInstanceOf(Date);
  });

  it('gives the same generic answer for a wrong password and an unknown e-mail', async () => {
    await seedSuper();
    const wrong = await authenticate({ email: SUPER.email, password: 'Wrong-Password-99!' }, REQUEST);
    const unknown = await authenticate({ email: 'nobody@incworx.test', password: 'Wrong-Password-99!' }, REQUEST);
    expect(wrong).toEqual({ ok: false, reason: 'invalid_credentials' });
    expect(unknown).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('refuses a PENDING admin — only after the password is proven', async () => {
    const superCtx = await seedSuper();
    await addAdmin(superCtx, ADMIN);
    expect(await authenticate({ email: ADMIN.email, password: 'Wrong-Password-99!' }, REQUEST)).toMatchObject({ reason: 'invalid_credentials' });
    expect(await authenticate({ email: ADMIN.email, password: PASSWORDS.admin }, REQUEST)).toMatchObject({ ok: false, reason: 'pending' });
  });

  it('refuses a REJECTED admin', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN);
    await rejectAdmin(superCtx, { adminId: id, reason: 'Not part of the reports team' }, REQUEST);
    expect(await authenticate({ email: ADMIN.email, password: PASSWORDS.admin }, REQUEST)).toMatchObject({ ok: false, reason: 'rejected' });
  });

  it('refuses an INACTIVE admin', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN, { approve: true });
    await setAdminActive(superCtx, { adminId: id, active: false }, REQUEST);
    expect(await authenticate({ email: ADMIN.email, password: PASSWORDS.admin }, REQUEST)).toMatchObject({ ok: false, reason: 'inactive' });
  });

  it('rejects malformed input before touching the database', async () => {
    expect(await authenticate({ email: 'not-an-email', password: '' }, REQUEST)).toEqual({ ok: false, reason: 'invalid_input' });
  });

  it('audits success and failure without storing any secret', async () => {
    await seedSuper();
    await authenticate({ email: SUPER.email, password: 'Wrong-Password-99!' }, REQUEST);
    await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, REQUEST);
    const events = await db().auditLog.findMany({ where: { action: { in: ['LOGIN_FAILED', 'LOGIN_SUCCEEDED'] } }, orderBy: { createdAt: 'asc' } });
    expect(events.map((e) => e.action)).toEqual(['LOGIN_FAILED', 'LOGIN_SUCCEEDED']);
    expect(events[0].metadata).toEqual({ reason: 'invalid_credentials' });
    expect(events[0].ipAddress).toBe(REQUEST.ipAddress);
    const everything = JSON.stringify(await db().auditLog.findMany());
    expect(everything).not.toContain(PASSWORDS.superAdmin);
    expect(everything).not.toContain('Wrong-Password-99!');
    expect(everything).not.toContain('$argon2');
  });
});

describe('rate limiting', () => {
  it(`locks an account after ${LOGIN_RATE_LIMITS.perEmail.max} failures — even the right password is then refused`, async () => {
    await seedSuper();
    const now = new Date();
    for (let i = 0; i < LOGIN_RATE_LIMITS.perEmail.max; i++) {
      expect((await authenticate({ email: SUPER.email, password: `Wrong-${i}-Password!` }, REQUEST, now)).ok).toBe(false);
    }
    const locked = await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, REQUEST, now);
    expect(locked).toMatchObject({ ok: false, reason: 'rate_limited' });
    if (!locked.ok) expect(locked.retryAfterMs).toBeGreaterThan(14 * 60 * 1000);
  });

  it('opens again once the window has passed', async () => {
    await seedSuper();
    const start = new Date();
    for (let i = 0; i < LOGIN_RATE_LIMITS.perEmail.max; i++) {
      await authenticate({ email: SUPER.email, password: `Wrong-${i}-Password!` }, REQUEST, start);
    }
    const later = new Date(start.getTime() + LOGIN_RATE_LIMITS.perEmail.windowMs + 1000);
    expect((await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, REQUEST, later)).ok).toBe(true);
  });

  it('limits one IP spraying many accounts', async () => {
    await seedSuper();
    const now = new Date();
    for (let i = 0; i < LOGIN_RATE_LIMITS.perIp.max; i++) {
      await authenticate({ email: `user${i}@incworx.test`, password: 'Wrong-Password-99!' }, REQUEST, now);
    }
    expect(await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, REQUEST, now)).toMatchObject({ reason: 'rate_limited' });
    // A different source is unaffected.
    expect((await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, { ...REQUEST, ipAddress: '198.51.100.7' }, now)).ok).toBe(true);
  });

  it('stores only hashed keys — no e-mail or IP in the clear', async () => {
    await seedSuper();
    await authenticate({ email: SUPER.email, password: 'Wrong-Password-99!' }, REQUEST);
    const rows = JSON.stringify(await db().authAttempt.findMany());
    expect(rows).not.toContain(SUPER.email);
    expect(rows).not.toContain(REQUEST.ipAddress);
  });

  it('forgives earlier failures after a successful sign-in', async () => {
    await seedSuper();
    for (let i = 0; i < LOGIN_RATE_LIMITS.perEmail.max - 1; i++) {
      await authenticate({ email: SUPER.email, password: `Wrong-${i}-Password!` }, REQUEST);
    }
    expect((await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, REQUEST)).ok).toBe(true);
    for (let i = 0; i < LOGIN_RATE_LIMITS.perEmail.max - 1; i++) {
      await authenticate({ email: SUPER.email, password: `Again-${i}-Password!` }, REQUEST);
    }
    expect((await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, REQUEST)).ok).toBe(true);
  });
});

describe('sessions', () => {
  it('expires after the absolute lifetime, even if used constantly', async () => {
    const superCtx = await seedSuper();
    const start = new Date();
    const { token } = await createSession(db(), superCtx.admin.id, REQUEST, start);
    // Keep it busy right up to the limit…
    for (let t = SESSION_IDLE_TTL_MS / 2; t < SESSION_ABSOLUTE_TTL_MS; t += SESSION_IDLE_TTL_MS / 2) {
      expect(await validateSession(token, new Date(start.getTime() + t))).not.toBeNull();
    }
    // …and it still ends.
    expect(await validateSession(token, new Date(start.getTime() + SESSION_ABSOLUTE_TTL_MS + 1))).toBeNull();
  });

  it('expires after being idle', async () => {
    const superCtx = await seedSuper();
    const start = new Date();
    const { token } = await createSession(db(), superCtx.admin.id, REQUEST, start);
    expect(await validateSession(token, new Date(start.getTime() + SESSION_IDLE_TTL_MS + 1000))).toBeNull();
    expect(await db().adminSession.count({ where: { tokenHash: hashSessionToken(token) } })).toBe(0);
  });

  it('rejects tokens that were never issued', async () => {
    expect(await validateSession('x'.repeat(43))).toBeNull();
    expect(await validateSession('short')).toBeNull();
    expect(await validateSession(undefined)).toBeNull();
  });

  it('sign-out ends the session and is audited', async () => {
    await seedSuper();
    const result = await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, REQUEST);
    if (!result.ok) throw new Error('sign-in failed');
    await signOut(result.token, REQUEST);
    expect(await validateSession(result.token)).toBeNull();
    expect(await db().auditLog.count({ where: { action: 'LOGOUT', actorId: result.admin.id } })).toBe(1);
  });

  it('deactivation cuts access immediately — the open session stops working', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN, { approve: true });
    const login = await authenticate({ email: ADMIN.email, password: PASSWORDS.admin }, REQUEST);
    if (!login.ok) throw new Error('sign-in failed');
    expect(await validateSession(login.token)).not.toBeNull();

    await setAdminActive(superCtx, { adminId: id, active: false }, REQUEST);
    expect(await validateSession(login.token)).toBeNull();
    expect(await db().adminSession.count({ where: { adminUserId: id } })).toBe(0);
  });

  it('rejection after approval cuts access immediately', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN, { approve: true });
    const login = await authenticate({ email: ADMIN.email, password: PASSWORDS.admin }, REQUEST);
    if (!login.ok) throw new Error('sign-in failed');
    await rejectAdmin(superCtx, { adminId: id }, REQUEST);
    expect(await validateSession(login.token)).toBeNull();
  });

  it('even a session the revocation missed is refused, because every request re-checks the account', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN, { approve: true });
    const { token } = await createSession(db(), id, REQUEST);
    // Simulate an out-of-band change (e.g. SQL) that does not touch sessions.
    await db().adminUser.update({ where: { id }, data: { isActive: false } });
    expect(await validateSession(token)).toBeNull();
  });
});

describe('password change', () => {
  it('requires the current password, ends every other session, rotates the current one', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN, { approve: true });
    const phone = await authenticate({ email: ADMIN.email, password: PASSWORDS.admin }, REQUEST);
    const laptop = await authenticate({ email: ADMIN.email, password: PASSWORDS.admin }, REQUEST);
    if (!phone.ok || !laptop.ok) throw new Error('sign-in failed');
    const ctx = (await validateSession(laptop.token))!;

    const wrong = await changePassword(ctx, { currentPassword: 'Not-My-Password-1!', newPassword: PASSWORDS.other, confirmPassword: PASSWORDS.other }, REQUEST);
    expect(wrong).toMatchObject({ ok: false, fieldErrors: { currentPassword: ['Your current password is incorrect.'] } });

    const changed = await changePassword(ctx, { currentPassword: PASSWORDS.admin, newPassword: PASSWORDS.other, confirmPassword: PASSWORDS.other }, REQUEST);
    expect(changed).toMatchObject({ ok: true, otherSessionsEnded: 1 });
    if (!changed.ok) return;

    expect(await validateSession(phone.token)).toBeNull(); // other device: signed out
    expect(await validateSession(laptop.token)).toBeNull(); // old token on this device: rotated away
    expect(await validateSession(changed.token)).not.toBeNull(); // the new one works

    expect((await authenticate({ email: ADMIN.email, password: PASSWORDS.admin }, REQUEST)).ok).toBe(false);
    expect((await authenticate({ email: ADMIN.email, password: PASSWORDS.other }, REQUEST)).ok).toBe(true);
    expect(await db().auditLog.count({ where: { action: 'PASSWORD_CHANGED', actorId: id } })).toBe(1);
  });

  it('applies the strong policy to the new password, server-side', async () => {
    const superCtx = await seedSuper();
    const result = await changePassword(superCtx, { currentPassword: PASSWORDS.superAdmin, newPassword: 'Summer2026!!', confirmPassword: 'Summer2026!!' }, REQUEST);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.newPassword?.[0]).toMatch(/too easy to guess/);
  });

  it('rate-limits current-password guesses from a hijacked session', async () => {
    const superCtx = await seedSuper();
    for (let i = 0; i < 5; i++) {
      await changePassword(superCtx, { currentPassword: `Guess-${i}-Password!`, newPassword: PASSWORDS.other, confirmPassword: PASSWORDS.other }, REQUEST);
    }
    const blocked = await changePassword(superCtx, { currentPassword: PASSWORDS.superAdmin, newPassword: PASSWORDS.other, confirmPassword: PASSWORDS.other }, REQUEST);
    expect(blocked).toMatchObject({ ok: false });
    if (!blocked.ok) expect(blocked.message).toMatch(/Too many attempts/);
  });

  it('works for the account it belongs to only', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN, { approve: true });
    const adminCtx = await contextFor(id);
    await changePassword(adminCtx, { currentPassword: PASSWORDS.admin, newPassword: PASSWORDS.other, confirmPassword: PASSWORDS.other }, REQUEST);
    // The Super Admin's own password is unaffected.
    expect((await authenticate({ email: SUPER.email, password: PASSWORDS.superAdmin }, REQUEST)).ok).toBe(true);
  });
});

describe('approval keeps the approver', () => {
  it('records who approved and when', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN);
    await approveAdmin(superCtx, id, REQUEST);
    const row = await db().adminUser.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ approvalStatus: 'APPROVED', isActive: true, approvedById: superCtx.admin.id });
    expect(row.approvedAt).toBeInstanceOf(Date);
  });
});
