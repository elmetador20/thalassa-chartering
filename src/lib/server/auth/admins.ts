import 'server-only';
import type { AdminApprovalStatus, AdminRole } from '@/generated/prisma/client';
import { can, type Permission } from '@/lib/auth/permissions';
import {
  adminIdSchema,
  rejectAdminSchema,
  setAdminActiveSchema,
  toFieldErrors,
  type FieldErrors,
} from '@/lib/validation/auth';
import { AdminActionError, ForbiddenError } from './errors';
import type { AuthContext } from './session';
import { revokeAllSessions } from './session';
import { hashPassword } from './password';
import { createAdminServerSchema } from './password-strength';
import { recordAudit, type RequestMeta } from '../audit';
import { getDb, type DbTx } from '../db';

// ============================================================================
// Administrator management — the Super Admin's workflow.
//
// Every function takes the verified AuthContext of the person acting and
// checks the permission itself, so it is impossible to call one without
// first holding a valid session, and impossible to forget the check.
//
// State changes are conditional updates (`updateMany … where status = X`):
// the database applies the transition only if the account is still in the
// expected state, so two Super Admin tabs clicking at once cannot both win.
//
// Only role ADMIN accounts are ever targeted. Super Admin accounts cannot be
// created, approved, rejected or deactivated from here; the database trigger
// additionally guarantees the last active Super Admin survives any other path.
// ============================================================================

function assertPermission(ctx: AuthContext, permission: Permission): void {
  if (!can(ctx.admin.role, permission)) throw new ForbiddenError();
}

// ------------------------------------------------------------------ create --

export type CreateAdminResult =
  | { ok: true; adminId: string; name: string }
  | { ok: false; fieldErrors?: FieldErrors; message?: string };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

export async function createAdmin(
  ctx: AuthContext,
  raw: { name: unknown; email: unknown; password: unknown; confirmPassword: unknown },
  request: RequestMeta | null,
): Promise<CreateAdminResult> {
  assertPermission(ctx, 'admins:create');

  const parsed = await createAdminServerSchema.safeParseAsync(raw);
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  const { name, email, password } = parsed.data;

  const db = getDb();
  const duplicate = { fieldErrors: { email: ['An administrator with this email already exists.'] } };
  if (await db.adminUser.findUnique({ where: { email }, select: { id: true } })) return { ok: false, ...duplicate };

  const passwordHash = await hashPassword(password);
  try {
    const created = await db.$transaction(async (tx) => {
      const admin = await tx.adminUser.create({
        // Fixed, never taken from input: the only role this workflow can grant.
        data: { name, email, passwordHash, role: 'ADMIN', approvalStatus: 'PENDING', isActive: false },
        select: { id: true },
      });
      await recordAudit(tx, {
        action: 'ADMIN_CREATED',
        actorId: ctx.admin.id,
        targetType: 'admin_user',
        targetId: admin.id,
        metadata: { name, email },
        request,
      });
      return admin;
    });
    return { ok: true, adminId: created.id, name };
  } catch (error) {
    // Lost a race with a simultaneous create for the same address.
    if (isUniqueViolation(error)) return { ok: false, ...duplicate };
    throw error;
  }
}

// ------------------------------------------------------------ transitions --

function parseTargetId(ctx: AuthContext, value: unknown): string {
  const parsed = adminIdSchema.safeParse(value);
  if (!parsed.success) throw new AdminActionError('Unknown administrator.');
  if (parsed.data === ctx.admin.id) throw new AdminActionError("You can't change your own account here.");
  return parsed.data;
}

/** Explains why a conditional update matched nothing. */
async function refusal(tx: DbTx, id: string, attempted: 'approve' | 'reject' | 'activate' | 'deactivate'): Promise<AdminActionError> {
  const target = await tx.adminUser.findUnique({
    where: { id },
    select: { role: true, approvalStatus: true, isActive: true },
  });
  if (!target) return new AdminActionError('Administrator not found.');
  if (target.role === 'SUPER_ADMIN') return new AdminActionError("Super Admin accounts can't be changed here.");
  const already: Record<typeof attempted, string> = {
    approve: 'This account is already approved.',
    reject: 'This account is already rejected.',
    activate:
      target.approvalStatus === 'APPROVED' ? 'This account is already active.' : 'Approve this account before activating it.',
    deactivate:
      target.approvalStatus === 'APPROVED' ? 'This account is already inactive.' : 'Only approved accounts can be deactivated.',
  };
  return new AdminActionError(already[attempted]);
}

export async function approveAdmin(ctx: AuthContext, adminId: unknown, request: RequestMeta | null): Promise<void> {
  assertPermission(ctx, 'admins:approve');
  const id = parseTargetId(ctx, adminId);
  const now = new Date();

  await getDb().$transaction(async (tx) => {
    const { count } = await tx.adminUser.updateMany({
      where: { id, role: 'ADMIN', approvalStatus: { in: ['PENDING', 'REJECTED'] } },
      data: { approvalStatus: 'APPROVED', isActive: true, approvedById: ctx.admin.id, approvedAt: now, rejectionReason: null },
    });
    if (count === 0) throw await refusal(tx, id, 'approve');
    await recordAudit(tx, { action: 'ADMIN_APPROVED', actorId: ctx.admin.id, targetType: 'admin_user', targetId: id, request });
  });
}

export async function rejectAdmin(
  ctx: AuthContext,
  input: { adminId: unknown; reason?: unknown },
  request: RequestMeta | null,
): Promise<{ sessionsEnded: number }> {
  assertPermission(ctx, 'admins:approve');
  const parsed = rejectAdminSchema.safeParse({
    adminId: input.adminId,
    reason: typeof input.reason === 'string' ? input.reason : undefined,
  });
  if (!parsed.success) {
    const errors = toFieldErrors(parsed.error);
    throw new AdminActionError(errors.reason?.[0] ?? 'Unknown administrator.', errors.reason ? 'reason' : undefined);
  }
  const id = parseTargetId(ctx, parsed.data.adminId);

  return getDb().$transaction(async (tx) => {
    const previous = await tx.adminUser.findUnique({ where: { id }, select: { approvalStatus: true } });
    const { count } = await tx.adminUser.updateMany({
      // Pending accounts, and approved ones being withdrawn.
      where: { id, role: 'ADMIN', approvalStatus: { in: ['PENDING', 'APPROVED'] } },
      data: {
        approvalStatus: 'REJECTED',
        isActive: false,
        approvedById: null,
        approvedAt: null,
        rejectionReason: parsed.data.reason,
      },
    });
    if (count === 0) throw await refusal(tx, id, 'reject');
    const sessionsEnded = await revokeAllSessions(tx, id);
    await recordAudit(tx, {
      action: 'ADMIN_REJECTED',
      actorId: ctx.admin.id,
      targetType: 'admin_user',
      targetId: id,
      metadata: { previousStatus: previous?.approvalStatus ?? null, reason: parsed.data.reason, sessionsEnded },
      request,
    });
    return { sessionsEnded };
  });
}

export async function setAdminActive(
  ctx: AuthContext,
  input: { adminId: unknown; active: unknown },
  request: RequestMeta | null,
): Promise<{ sessionsEnded: number }> {
  assertPermission(ctx, 'admins:set-active');
  const parsed = setAdminActiveSchema.safeParse(input);
  if (!parsed.success) throw new AdminActionError('Invalid request.');
  const id = parseTargetId(ctx, parsed.data.adminId);
  const { active } = parsed.data;

  return getDb().$transaction(async (tx) => {
    const { count } = await tx.adminUser.updateMany({
      where: { id, role: 'ADMIN', approvalStatus: 'APPROVED', isActive: !active },
      data: { isActive: active },
    });
    if (count === 0) throw await refusal(tx, id, active ? 'activate' : 'deactivate');
    // Deactivation is immediate: every open session ends now.
    const sessionsEnded = active ? 0 : await revokeAllSessions(tx, id);
    await recordAudit(tx, {
      action: active ? 'ADMIN_ACTIVATED' : 'ADMIN_DEACTIVATED',
      actorId: ctx.admin.id,
      targetType: 'admin_user',
      targetId: id,
      metadata: active ? {} : { sessionsEnded },
      request,
    });
    return { sessionsEnded };
  });
}

// ------------------------------------------------------------------- reads --

export interface AdminListItem {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  approvalStatus: AdminApprovalStatus;
  isActive: boolean;
  approvedBy: { id: string; name: string } | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export async function listAdmins(ctx: AuthContext): Promise<AdminListItem[]> {
  assertPermission(ctx, 'admins:view');
  const rows = await getDb().adminUser.findMany({
    // Enum order is PENDING, APPROVED, REJECTED — so pending accounts lead.
    orderBy: [{ approvalStatus: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      approvalStatus: true,
      isActive: true,
      approvedAt: true,
      rejectionReason: true,
      lastLoginAt: true,
      createdAt: true,
      approvedBy: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface AdminCounts {
  pending: number;
  active: number;
  inactive: number;
  rejected: number;
}

/** Administrator (role ADMIN) totals for the dashboard. */
export async function getAdminCounts(ctx: AuthContext): Promise<AdminCounts> {
  assertPermission(ctx, 'admins:view');
  const groups = await getDb().adminUser.groupBy({
    by: ['approvalStatus', 'isActive'],
    where: { role: 'ADMIN' },
    _count: { _all: true },
  });
  const counts: AdminCounts = { pending: 0, active: 0, inactive: 0, rejected: 0 };
  for (const g of groups) {
    const n = g._count._all;
    if (g.approvalStatus === 'PENDING') counts.pending += n;
    else if (g.approvalStatus === 'REJECTED') counts.rejected += n;
    else if (g.isActive) counts.active += n;
    else counts.inactive += n;
  }
  return counts;
}
