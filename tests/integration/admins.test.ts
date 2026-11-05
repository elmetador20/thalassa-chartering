import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/lib/server/db';
import { approveAdmin, createAdmin, getAdminCounts, listAdmins, rejectAdmin, setAdminActive } from '@/lib/server/auth/admins';
import { AdminActionError, ForbiddenError } from '@/lib/server/auth/errors';
import { listRecentActivity } from '@/lib/server/audit';
import { addAdmin, contextFor, PASSWORDS, REQUEST, resetDatabase, seedSuper } from '../support/fixtures';

const db = () => getDb();
const RAVI = { name: 'Ravi Kumar', email: 'ravi@incworx.test' };
const ANITA = { name: 'Anita Desai', email: 'anita@incworx.test' };

/** Expect a database rule to refuse a raw write, naming the rule. */
async function expectDbRefusal(sql: string, rule: string) {
  await expect(db().$executeRawUnsafe(sql)).rejects.toThrow(rule);
}

beforeEach(resetDatabase);

describe('creating administrators', () => {
  it('creates an ADMIN that is PENDING and inactive, with a hashed password', async () => {
    const superCtx = await seedSuper();
    const result = await createAdmin(superCtx, { ...RAVI, password: PASSWORDS.admin, confirmPassword: PASSWORDS.admin }, REQUEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await db().adminUser.findUniqueOrThrow({ where: { id: result.adminId }, omit: { passwordHash: false } });
    expect(row).toMatchObject({ role: 'ADMIN', approvalStatus: 'PENDING', isActive: false, approvedById: null });
    expect(row.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('cannot be tricked into granting SUPER_ADMIN', async () => {
    const superCtx = await seedSuper();
    const raw = { ...RAVI, password: PASSWORDS.admin, confirmPassword: PASSWORDS.admin, role: 'SUPER_ADMIN', approvalStatus: 'APPROVED', isActive: true };
    const result = await createAdmin(superCtx, raw as never, REQUEST);
    if (!result.ok) throw new Error('create failed');
    expect(await db().adminUser.findUniqueOrThrow({ where: { id: result.adminId } })).toMatchObject({
      role: 'ADMIN',
      approvalStatus: 'PENDING',
      isActive: false,
    });
  });

  it('rejects duplicate e-mails, ignoring case and spaces', async () => {
    const superCtx = await seedSuper();
    await addAdmin(superCtx, RAVI);
    const again = await createAdmin(superCtx, { name: 'Ravi K', email: '  RAVI@incworx.TEST ', password: PASSWORDS.other, confirmPassword: PASSWORDS.other }, REQUEST);
    expect(again).toEqual({ ok: false, fieldErrors: { email: ['An administrator with this email already exists.'] } });
  });

  it('validates on the server — weak passwords are refused however the request arrives', async () => {
    const superCtx = await seedSuper();
    for (const weak of ['inc134', 'password123', 'Password123!', 'Summer2026!!']) {
      const r = await createAdmin(superCtx, { ...RAVI, password: weak, confirmPassword: weak }, REQUEST);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fieldErrors?.password?.length).toBeGreaterThan(0);
    }
    expect(await db().adminUser.count({ where: { role: 'ADMIN' } })).toBe(0);
  });

  it('writes an audit record with no secrets', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, RAVI);
    const event = await db().auditLog.findFirstOrThrow({ where: { action: 'ADMIN_CREATED' } });
    expect(event).toMatchObject({ actorId: superCtx.admin.id, targetType: 'admin_user', targetId: id });
    expect(event.metadata).toEqual({ name: RAVI.name, email: RAVI.email });
    expect(JSON.stringify(event)).not.toContain(PASSWORDS.admin);
  });
});

describe('approval workflow', () => {
  it('approves: APPROVED, active, approver and time recorded, audited', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, RAVI);
    await approveAdmin(superCtx, id, REQUEST);
    expect(await db().adminUser.findUniqueOrThrow({ where: { id } })).toMatchObject({
      approvalStatus: 'APPROVED',
      isActive: true,
      approvedById: superCtx.admin.id,
      rejectionReason: null,
    });
    expect(await db().auditLog.count({ where: { action: 'ADMIN_APPROVED', targetId: id } })).toBe(1);
  });

  it('rejects with a reason: REJECTED, inactive, reason saved, audited', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, RAVI);
    await rejectAdmin(superCtx, { adminId: id, reason: '  Duplicate request  ' }, REQUEST);
    expect(await db().adminUser.findUniqueOrThrow({ where: { id } })).toMatchObject({
      approvalStatus: 'REJECTED',
      isActive: false,
      rejectionReason: 'Duplicate request',
    });
    const event = await db().auditLog.findFirstOrThrow({ where: { action: 'ADMIN_REJECTED' } });
    expect(event.metadata).toMatchObject({ previousStatus: 'PENDING', reason: 'Duplicate request' });
  });

  it('a rejected account can be approved later', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, RAVI);
    await rejectAdmin(superCtx, { adminId: id }, REQUEST);
    await approveAdmin(superCtx, id, REQUEST);
    expect(await db().adminUser.findUniqueOrThrow({ where: { id } })).toMatchObject({ approvalStatus: 'APPROVED', rejectionReason: null });
  });

  it('refuses invalid transitions with a clear reason', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, RAVI, { approve: true });
    await expect(approveAdmin(superCtx, id, REQUEST)).rejects.toThrow('This account is already approved.');
    await expect(setAdminActive(superCtx, { adminId: id, active: true }, REQUEST)).rejects.toThrow('This account is already active.');

    const pendingId = await addAdmin(superCtx, ANITA);
    await expect(setAdminActive(superCtx, { adminId: pendingId, active: true }, REQUEST)).rejects.toThrow('Approve this account before activating it.');
  });

  it('activates and deactivates, auditing both', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, RAVI, { approve: true });
    await setAdminActive(superCtx, { adminId: id, active: false }, REQUEST);
    expect((await db().adminUser.findUniqueOrThrow({ where: { id } })).isActive).toBe(false);
    await setAdminActive(superCtx, { adminId: id, active: true }, REQUEST);
    expect((await db().adminUser.findUniqueOrThrow({ where: { id } })).isActive).toBe(true);
    expect(await db().auditLog.count({ where: { action: { in: ['ADMIN_ACTIVATED', 'ADMIN_DEACTIVATED'] }, targetId: id } })).toBe(2);
  });

  it('two simultaneous approvals: exactly one wins', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, RAVI);
    const outcomes = await Promise.allSettled([approveAdmin(superCtx, id, REQUEST), approveAdmin(superCtx, id, REQUEST)]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(await db().auditLog.count({ where: { action: 'ADMIN_APPROVED', targetId: id } })).toBe(1);
  });

  it('dashboard counts reflect the workflow', async () => {
    const superCtx = await seedSuper();
    await addAdmin(superCtx, RAVI, { approve: true });
    const anita = await addAdmin(superCtx, ANITA);
    await addAdmin(superCtx, { name: 'Kiran Rao', email: 'kiran@incworx.test' });
    await rejectAdmin(superCtx, { adminId: anita }, REQUEST);
    expect(await getAdminCounts(superCtx)).toEqual({ pending: 1, active: 1, inactive: 0, rejected: 1 });
  });

  it('lists pending accounts first, with approver names, never password hashes', async () => {
    const superCtx = await seedSuper();
    await addAdmin(superCtx, RAVI, { approve: true });
    await addAdmin(superCtx, ANITA);
    const list = await listAdmins(superCtx);
    expect(list[0]).toMatchObject({ email: ANITA.email, approvalStatus: 'PENDING' });
    expect(list.find((a) => a.email === RAVI.email)?.approvedBy?.name).toBe('Meera Iyer');
    expect(JSON.stringify(list)).not.toContain('argon2');
  });
});

describe('role-based access — enforced on the server', () => {
  async function adminContext() {
    const superCtx = await seedSuper();
    const raviId = await addAdmin(superCtx, RAVI, { approve: true });
    const anitaId = await addAdmin(superCtx, ANITA);
    return { superCtx, adminCtx: await contextFor(raviId), raviId, anitaId };
  }

  it('an ADMIN cannot create administrators', async () => {
    const { adminCtx } = await adminContext();
    await expect(
      createAdmin(adminCtx, { name: 'Kiran Rao', email: 'kiran@incworx.test', password: PASSWORDS.other, confirmPassword: PASSWORDS.other }, REQUEST),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db().adminUser.count({ where: { email: 'kiran@incworx.test' } })).toBe(0);
  });

  it('an ADMIN cannot approve or reject administrators', async () => {
    const { adminCtx, anitaId } = await adminContext();
    await expect(approveAdmin(adminCtx, anitaId, REQUEST)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(rejectAdmin(adminCtx, { adminId: anitaId }, REQUEST)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db().adminUser.findUniqueOrThrow({ where: { id: anitaId } })).approvalStatus).toBe('PENDING');
  });

  it('an ADMIN cannot activate, deactivate or list administrators', async () => {
    const { adminCtx, anitaId, raviId } = await adminContext();
    await expect(setAdminActive(adminCtx, { adminId: anitaId, active: true }, REQUEST)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setAdminActive(adminCtx, { adminId: raviId, active: false }, REQUEST)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listAdmins(adminCtx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getAdminCounts(adminCtx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('nobody can approve or change their own account', async () => {
    const { superCtx } = await adminContext();
    await expect(setAdminActive(superCtx, { adminId: superCtx.admin.id, active: false }, REQUEST)).rejects.toThrow("You can't change your own account here.");
    await expect(rejectAdmin(superCtx, { adminId: superCtx.admin.id }, REQUEST)).rejects.toThrow("You can't change your own account here.");
  });

  it('Super Admin accounts are not manageable from the admin workflow', async () => {
    const { superCtx } = await adminContext();
    // A second Super Admin, inserted the only other way possible: directly.
    const other = await db().adminUser.create({
      data: { name: 'Second Super', email: 'second@incworx.test', passwordHash: 'x', role: 'SUPER_ADMIN', approvalStatus: 'APPROVED', isActive: true, approvedAt: new Date() },
    });
    await expect(setAdminActive(superCtx, { adminId: other.id, active: false }, REQUEST)).rejects.toThrow("Super Admin accounts can't be changed here.");
    await expect(rejectAdmin(superCtx, { adminId: other.id }, REQUEST)).rejects.toThrow("Super Admin accounts can't be changed here.");
  });

  it('garbage identifiers are refused, not passed to the database', async () => {
    const { superCtx } = await adminContext();
    await expect(approveAdmin(superCtx, "1' OR '1'='1", REQUEST)).rejects.toBeInstanceOf(AdminActionError);
    await expect(setAdminActive(superCtx, { adminId: 'x', active: 'yes' }, REQUEST)).rejects.toBeInstanceOf(AdminActionError);
  });

  it('an ADMIN sees only their own activity; a Super Admin sees everyone’s', async () => {
    const { superCtx, adminCtx } = await adminContext();
    const mine = await listRecentActivity({ actorId: adminCtx.admin.id });
    expect(mine.every((e) => e.actor?.id === adminCtx.admin.id)).toBe(true);
    const all = await listRecentActivity({ limit: 50 });
    expect(all.some((e) => e.actor?.id === superCtx.admin.id)).toBe(true);
  });
});

describe('database-level guarantees (hold even for raw SQL / Prisma Studio)', () => {
  it('the last active Super Admin cannot be deactivated, demoted or deleted', async () => {
    const superCtx = await seedSuper();
    const id = superCtx.admin.id;
    await expectDbRefusal(`UPDATE incworx.admin_users SET is_active = false WHERE id = '${id}'`, 'admin_users_last_super_admin');
    await expectDbRefusal(`UPDATE incworx.admin_users SET role = 'ADMIN' WHERE id = '${id}'`, 'admin_users_last_super_admin');
    await expectDbRefusal(`DELETE FROM incworx.admin_users WHERE id = '${id}'`, 'admin_users_last_super_admin');
    expect(await db().adminUser.findUniqueOrThrow({ where: { id } })).toMatchObject({ role: 'SUPER_ADMIN', isActive: true });
  });

  it('…but one of two Super Admins can be deactivated', async () => {
    const superCtx = await seedSuper();
    await db().adminUser.create({
      data: { name: 'Second Super', email: 'second@incworx.test', passwordHash: 'x', role: 'SUPER_ADMIN', approvalStatus: 'APPROVED', isActive: true, approvedAt: new Date() },
    });
    await db().$executeRawUnsafe(`UPDATE incworx.admin_users SET is_active = false WHERE id = '${superCtx.admin.id}'`);
    // …and then the remaining one is protected.
    await expectDbRefusal(`UPDATE incworx.admin_users SET is_active = false WHERE email = 'second@incworx.test'`, 'admin_users_last_super_admin');
  });

  it('concurrent attempts to deactivate both of two Super Admins: one is refused', async () => {
    const superCtx = await seedSuper();
    const second = await db().adminUser.create({
      data: { name: 'Second Super', email: 'second@incworx.test', passwordHash: 'x', role: 'SUPER_ADMIN', approvalStatus: 'APPROVED', isActive: true, approvedAt: new Date() },
    });
    const results = await Promise.allSettled([
      db().$executeRawUnsafe(`UPDATE incworx.admin_users SET is_active = false WHERE id = '${superCtx.admin.id}'`),
      db().$executeRawUnsafe(`UPDATE incworx.admin_users SET is_active = false WHERE id = '${second.id}'`),
    ]);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await db().adminUser.count({ where: { role: 'SUPER_ADMIN', isActive: true } })).toBe(1);
  });

  it('only a Super Admin can be recorded as an approver', async () => {
    const superCtx = await seedSuper();
    const ravi = await addAdmin(superCtx, RAVI, { approve: true });
    const anita = await addAdmin(superCtx, ANITA);
    await expectDbRefusal(
      `UPDATE incworx.admin_users SET approval_status = 'APPROVED', is_active = true, approved_at = now(), approved_by_id = '${ravi}' WHERE id = '${anita}'`,
      'admin_users_approver_is_super_admin',
    );
  });

  it('nobody approves themselves', async () => {
    const superCtx = await seedSuper();
    const anita = await addAdmin(superCtx, ANITA);
    // An admin approving themselves is stopped first by the approver-role
    // trigger (BEFORE triggers run ahead of CHECK constraints)…
    await expectDbRefusal(
      `UPDATE incworx.admin_users SET approval_status = 'APPROVED', is_active = true, approved_at = now(), approved_by_id = '${anita}' WHERE id = '${anita}'`,
      'admin_users_approver_is_super_admin',
    );
    // …and even a Super Admin — who passes that trigger — cannot be recorded
    // as their own approver: the CHECK catches it.
    await expectDbRefusal(
      `UPDATE incworx.admin_users SET approved_by_id = id WHERE id = '${superCtx.admin.id}'`,
      'admin_users_no_self_approval_chk',
    );
  });

  it('a pending or rejected account can never be active', async () => {
    const superCtx = await seedSuper();
    const anita = await addAdmin(superCtx, ANITA);
    await expectDbRefusal(`UPDATE incworx.admin_users SET is_active = true WHERE id = '${anita}'`, 'admin_users_active_requires_approval_chk');
  });

  it('an ADMIN cannot be approved without a recorded approver', async () => {
    const superCtx = await seedSuper();
    const anita = await addAdmin(superCtx, ANITA);
    await expectDbRefusal(
      `UPDATE incworx.admin_users SET approval_status = 'APPROVED', approved_at = now() WHERE id = '${anita}'`,
      'admin_users_admin_approval_has_approver_chk',
    );
  });

  it('the audit log is append-only: no update, delete or truncate', async () => {
    const superCtx = await seedSuper();
    await addAdmin(superCtx, RAVI);
    await expectDbRefusal(`UPDATE incworx.audit_logs SET action = 'LOGOUT'`, 'audit_logs_append_only');
    await expectDbRefusal(`DELETE FROM incworx.audit_logs`, 'audit_logs_append_only');
    await expectDbRefusal(`TRUNCATE incworx.audit_logs`, 'audit_logs_append_only');
    expect(await db().auditLog.count()).toBeGreaterThan(0);
  });
});
