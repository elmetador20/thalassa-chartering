import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/server/db';
import { ForbiddenError } from '@/lib/server/auth/errors';
import {
  approveAccessRequest,
  getAccessRequestCounts,
  listAccessRequests,
  regenerateInvitation,
  rejectAccessRequest,
  submitAccessRequest,
} from '@/lib/server/auth/access-requests';
import { acceptInvitation, inspectInvitation } from '@/lib/server/auth/invitations';
import { authenticate } from '@/lib/server/auth/login';
import type { AuthContext } from '@/lib/server/auth/session';
import { addAdmin, contextFor, PASSWORDS, REQUEST, resetDatabase, seedSuper } from '../support/fixtures';

const db = () => getDb();
const NEW_PASSWORD = PASSWORDS.other;
let superCtx: AuthContext;
let adminCtx: AuthContext;

const form = (o: Record<string, string> = {}) => ({
  fullName: 'Priya Sharma',
  email: '  Priya.Sharma@Example.TEST ',
  department: 'Chartering desk',
  designation: 'Analyst',
  reason: 'I prepare the weekly dry bulk reports for publication.',
  ...o,
});

async function submitAndGetId(o: Record<string, string> = {}) {
  expect(await submitAccessRequest(form(o), REQUEST)).toEqual({ ok: true });
  return (await db().accessRequest.findFirstOrThrow({ orderBy: { createdAt: 'desc' } })).id;
}

beforeEach(async () => {
  await resetDatabase();
  superCtx = await seedSuper();
  adminCtx = await contextFor(await addAdmin(superCtx, { name: 'Ravi Kumar', email: 'ravi@incworx.test' }, { approve: true }));
});
afterEach(() => vi.useRealTimers());

describe('request access (public)', () => {
  it('stores a pending request with a normalised email, no account, audited', async () => {
    const id = await submitAndGetId();
    const row = await db().accessRequest.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ email: 'priya.sharma@example.test', status: 'PENDING', pendingEmail: 'priya.sharma@example.test', reviewedById: null });
    expect(await db().adminUser.count({ where: { email: 'priya.sharma@example.test' } })).toBe(0);
    expect(await db().auditLog.count({ where: { action: 'ACCESS_REQUEST_SUBMITTED', targetId: id, actorId: null } })).toBe(1);
  });

  it('answers identically for a second pending request and for an existing account — and stores neither', async () => {
    await submitAndGetId();
    expect(await submitAccessRequest(form({ fullName: 'Someone Else' }), REQUEST)).toEqual({ ok: true });
    expect(await submitAccessRequest(form({ email: 'ravi@incworx.test' }), REQUEST)).toEqual({ ok: true });
    expect(await db().accessRequest.count()).toBe(1);
  });

  it('two simultaneous submissions for one email still leave a single pending request', async () => {
    const results = await Promise.all([submitAccessRequest(form(), REQUEST), submitAccessRequest(form(), { ...REQUEST, ipAddress: '198.51.100.9' })]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(await db().accessRequest.count({ where: { status: 'PENDING' } })).toBe(1);
  });

  it('validates every field on the server', async () => {
    const r = await submitAccessRequest({ fullName: '', email: 'nope', department: 'x', designation: '', reason: 'short' }, REQUEST);
    expect(r.ok).toBe(false);
    expect(Object.keys((r as { fieldErrors: object }).fieldErrors).sort()).toEqual(['department', 'designation', 'email', 'fullName', 'reason']);
  });

  it('is rate-limited per email and per IP', async () => {
    for (let i = 0; i < 3; i++) await submitAccessRequest(form(), { ...REQUEST, ipAddress: `198.51.100.${i}` });
    expect(await submitAccessRequest(form(), { ...REQUEST, ipAddress: '198.51.100.50' })).toMatchObject({ ok: false, message: expect.stringMatching(/Too many/) });
    for (let i = 0; i < 5; i++) await submitAccessRequest(form({ email: `p${i}@example.test` }), { ...REQUEST, ipAddress: '203.0.113.99' });
    expect(await submitAccessRequest(form({ email: 'other@example.test' }), { ...REQUEST, ipAddress: '203.0.113.99' })).toMatchObject({ ok: false });
  });
});

describe('review (Super Admin only)', () => {
  it('an ADMIN cannot list, count, approve, reject or regenerate', async () => {
    const id = await submitAndGetId();
    await expect(listAccessRequests(adminCtx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getAccessRequestCounts(adminCtx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(approveAccessRequest(adminCtx, { requestId: id, role: 'ADMIN' }, REQUEST)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(rejectAccessRequest(adminCtx, { requestId: id }, REQUEST)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(regenerateInvitation(adminCtx, id, REQUEST)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('approval records reviewer, time and role, stores only a token hash, and audits each step', async () => {
    const id = await submitAndGetId();
    const issued = await approveAccessRequest(superCtx, { requestId: id, role: 'ADMIN' }, REQUEST);
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const req = await db().accessRequest.findUniqueOrThrow({ where: { id } });
    expect(req).toMatchObject({ status: 'APPROVED', assignedRole: 'ADMIN', reviewedById: superCtx.admin.id, pendingEmail: null });
    const inv = await db().adminInvitation.findFirstOrThrow({ where: { accessRequestId: id } });
    expect(inv.tokenHash).toBe(createHash('sha256').update(issued.token).digest('hex'));
    expect(JSON.stringify(inv)).not.toContain(issued.token);
    expect(inv.expiresAt.getTime() - inv.createdAt.getTime()).toBe(24 * 60 * 60 * 1000);
    const actions = (await db().auditLog.findMany({ where: { targetId: id }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['ACCESS_REQUEST_SUBMITTED', 'ACCESS_REQUEST_APPROVED', 'ROLE_ASSIGNED', 'INVITATION_CREATED']));
    expect(JSON.stringify(await db().auditLog.findMany())).not.toContain(issued.token);
    expect(await db().adminUser.count({ where: { email: req.email } })).toBe(0); // no account yet
  });

  it('refuses privileged roles, a second decision, and an email that already has an account', async () => {
    const id = await submitAndGetId();
    await expect(approveAccessRequest(superCtx, { requestId: id, role: 'SUPER_ADMIN' }, REQUEST)).rejects.toThrow(/role/i);
    await rejectAccessRequest(superCtx, { requestId: id, reason: 'Not on the team' }, REQUEST);
    await expect(approveAccessRequest(superCtx, { requestId: id, role: 'ADMIN' }, REQUEST)).rejects.toThrow(/already been rejected/);

    // A new request for an address that already has an account (inserted directly).
    await db().accessRequest.create({ data: { ...form({ email: 'ravi@incworx.test' }), email: 'ravi@incworx.test', pendingEmail: 'ravi@incworx.test' } });
    const dup = (await db().accessRequest.findFirstOrThrow({ where: { email: 'ravi@incworx.test' } })).id;
    await expect(approveAccessRequest(superCtx, { requestId: dup, role: 'ADMIN' }, REQUEST)).rejects.toThrow(/already uses this email/);
  });

  it('rejection records reason, reviewer and time; no account; a new request is then possible', async () => {
    const id = await submitAndGetId();
    await rejectAccessRequest(superCtx, { requestId: id, reason: '  Not on the team  ' }, REQUEST);
    expect(await db().accessRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'REJECTED', rejectionReason: 'Not on the team', reviewedById: superCtx.admin.id });
    expect(await db().adminInvitation.count()).toBe(0);
    expect(await db().auditLog.count({ where: { action: 'ACCESS_REQUEST_REJECTED', targetId: id } })).toBe(1);
    await submitAndGetId();
    expect(await db().accessRequest.count()).toBe(2);
  });

  it('the database itself refuses self-approved requests and Super Admin invitations', async () => {
    await expect(
      db().accessRequest.create({ data: { ...form(), email: 'x@example.test', status: 'APPROVED', assignedRole: 'ADMIN', reviewedById: superCtx.admin.id, reviewedAt: new Date() } }),
    ).rejects.toThrow();
    const id = await submitAndGetId();
    await approveAccessRequest(superCtx, { requestId: id, role: 'ADMIN' }, REQUEST);
    await expect(
      db().$executeRawUnsafe(
        `INSERT INTO incworx.admin_invitations (access_request_id, email, name, role, token_hash, expires_at, created_by_id)
         VALUES ('${id}', 'priya.sharma@example.test', 'Priya', 'SUPER_ADMIN', repeat('a', 64), now() + interval '1 day', '${superCtx.admin.id}')`,
      ),
    ).rejects.toThrow(/admin_invitations_role_chk/);
    // An ADMIN cannot be recorded as the creator of an invitation either.
    await expect(
      db().$executeRawUnsafe(
        `INSERT INTO incworx.admin_invitations (access_request_id, email, name, role, token_hash, expires_at, created_by_id)
         VALUES ('${id}', 'priya.sharma@example.test', 'Priya', 'ADMIN', repeat('b', 64), now() + interval '1 day', '${adminCtx.admin.id}')`,
      ),
    ).rejects.toThrow(/creator_is_super_admin/);
  });
});

describe('invitation and account setup', () => {
  async function approved() {
    const id = await submitAndGetId();
    return { id, ...(await approveAccessRequest(superCtx, { requestId: id, role: 'ADMIN' }, REQUEST)) };
  }

  it('creates the account with the invited email and role, single use, and the new admin can sign in', async () => {
    const { id, token } = await approved();
    expect(await inspectInvitation(token, REQUEST)).toMatchObject({ ok: true, email: 'priya.sharma@example.test', name: 'Priya Sharma', role: 'ADMIN' });

    const out = await acceptInvitation({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, REQUEST);
    expect(out).toEqual({ ok: true, email: 'priya.sharma@example.test' });
    const admin = await db().adminUser.findUniqueOrThrow({ where: { email: 'priya.sharma@example.test' } });
    expect(admin).toMatchObject({ role: 'ADMIN', approvalStatus: 'APPROVED', isActive: true, approvedById: superCtx.admin.id });
    expect(await db().adminInvitation.findFirstOrThrow({ where: { accessRequestId: id } })).toMatchObject({ acceptedById: admin.id });
    expect(await db().auditLog.count({ where: { action: 'INVITATION_ACCEPTED', actorId: admin.id } })).toBe(1);

    // Single use.
    expect(await acceptInvitation({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, REQUEST)).toMatchObject({ ok: false });
    expect((await inspectInvitation(token, REQUEST)).ok).toBe(false);
    expect((await authenticate({ email: 'priya.sharma@example.test', password: NEW_PASSWORD }, REQUEST)).ok).toBe(true);
  });

  it('applies the existing password policy and leaves the invitation usable after a refusal', async () => {
    const { token } = await approved();
    const weak = await acceptInvitation({ token, password: 'password', confirmPassword: 'password' }, REQUEST);
    expect(weak).toMatchObject({ ok: false, fieldErrors: { password: expect.any(Array) } });
    const named = await acceptInvitation({ token, password: 'PriyaSharma#2026x', confirmPassword: 'PriyaSharma#2026x' }, REQUEST);
    expect(named.ok).toBe(false);
    const mismatch = await acceptInvitation({ token, password: NEW_PASSWORD, confirmPassword: `${NEW_PASSWORD}x` }, REQUEST);
    expect(mismatch).toMatchObject({ ok: false, fieldErrors: { confirmPassword: ['Passwords do not match.'] } });
    expect((await inspectInvitation(token, REQUEST)).ok).toBe(true);
  });

  it('expires after 24 hours', async () => {
    const { token } = await approved();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 24 * 60 * 60 * 1000 + 1000));
    expect(await acceptInvitation({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, REQUEST)).toMatchObject({ ok: false, message: expect.stringMatching(/expired/) });
    expect(await db().adminUser.count({ where: { email: 'priya.sharma@example.test' } })).toBe(0);
  });

  it('a new link revokes the old one', async () => {
    const { id, token: first } = await approved();
    const { token: second } = await regenerateInvitation(superCtx, id, REQUEST);
    expect((await inspectInvitation(first, REQUEST)).ok).toBe(false);
    expect((await inspectInvitation(second, REQUEST)).ok).toBe(true);
    expect(await db().auditLog.count({ where: { action: 'INVITATION_CREATED', targetId: id } })).toBe(2);
  });

  it('unknown and malformed tokens are refused the same way', async () => {
    for (const token of ['x'.repeat(43), 'short', '', null, '../../etc']) {
      expect(await inspectInvitation(token, { ...REQUEST, ipAddress: '192.0.2.77' })).toMatchObject({ ok: false, message: expect.stringMatching(/invalid/) });
    }
  });

  it('two simultaneous acceptances create exactly one account', async () => {
    const { token } = await approved();
    const results = await Promise.all([
      acceptInvitation({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, REQUEST),
      acceptInvitation({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, REQUEST),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db().adminUser.count({ where: { email: 'priya.sharma@example.test' } })).toBe(1);
  });
});
