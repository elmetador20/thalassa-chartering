import 'server-only';
import type { AccessRequestStatus, Prisma } from '@/generated/prisma/client';
import { can } from '@/lib/auth/permissions';
import { accessRequestSchema, approveRequestSchema, rejectRequestSchema, reviewIdSchema } from '@/lib/validation/access';
import { toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import { recordAudit, type RequestMeta } from '../audit';
import { getDb, type DbTx } from '../db';
import { AdminActionError, ForbiddenError } from './errors';
import { createInvitationTx, type IssuedInvitation } from './invitations';
import { ACCESS_REQUEST_RATE_LIMITS, consumeRateLimit, emailKey, ipKey } from './rate-limit';
import type { AuthContext } from './session';

// ============================================================================
// Access requests: the public "Request access" form and the Super Admin's
// review of it.
//
// A request holds no password and grants nothing. Approving one issues a
// single-use invitation (see invitations.ts); the account itself only comes
// into existence when the invited person sets their own password.
//
// Enumeration: the public submission answers the same way whether the e-mail
// is new, already has a pending request, or already has an account — only
// validation errors and rate limiting are ever reported.
// ============================================================================

function assertReviewer(ctx: AuthContext): void {
  if (!can(ctx.admin.role, 'access-requests:review')) throw new ForbiddenError();
}

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === 'P2002';

// ------------------------------------------------------------------ submit --

export type SubmitAccessRequestResult = { ok: true } | { ok: false; fieldErrors?: FieldErrors; message?: string };

export async function submitAccessRequest(raw: unknown, request: RequestMeta | null): Promise<SubmitAccessRequestResult> {
  const parsed = accessRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  const input = parsed.data;

  // Every submission counts, valid or not, per IP and per address.
  const [byIp, byEmail] = [
    { key: `access-request:${ipKey(request?.ipAddress ?? null)}`, ...ACCESS_REQUEST_RATE_LIMITS.perIp },
    { key: `access-request:${emailKey(input.email)}`, ...ACCESS_REQUEST_RATE_LIMITS.perEmail },
  ];
  const limits = await Promise.all([consumeRateLimit(byIp), consumeRateLimit(byEmail)]);
  if (limits.some((l) => l.limited)) {
    return { ok: false, message: 'Too many requests have been sent. Please try again later.' };
  }

  const db = getDb();
  // Already an administrator, or a request already waiting: say nothing, store
  // nothing — the response below is identical either way.
  const [account, pending] = await Promise.all([
    db.adminUser.findUnique({ where: { email: input.email }, select: { id: true } }),
    db.accessRequest.findUnique({ where: { pendingEmail: input.email }, select: { id: true } }),
  ]);
  if (account || pending) return { ok: true };

  try {
    await db.$transaction(async (tx) => {
      const created = await tx.accessRequest.create({
        data: { ...input, status: 'PENDING', pendingEmail: input.email },
        select: { id: true },
      });
      await recordAudit(tx, {
        action: 'ACCESS_REQUEST_SUBMITTED',
        actorId: null,
        targetType: 'access_request',
        targetId: created.id,
        metadata: { name: input.fullName, email: input.email, department: input.department },
        request,
      });
    });
  } catch (error) {
    // Lost a race with a simultaneous request for the same address: the other
    // one is pending, which is all the requester needs.
    if (!isUniqueViolation(error)) throw error;
  }
  return { ok: true };
}

// ------------------------------------------------------------------- reads --

export interface AccessRequestListItem {
  id: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  status: AccessRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: { name: string } | null;
}

export interface AccessRequestCounts {
  total: number;
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
}

export async function getAccessRequestCounts(ctx: AuthContext): Promise<AccessRequestCounts> {
  assertReviewer(ctx);
  const groups = await getDb().accessRequest.groupBy({ by: ['status'], _count: { _all: true } });
  const counts: AccessRequestCounts = { total: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const g of groups) {
    counts[g.status] = g._count._all;
    counts.total += g._count._all;
  }
  return counts;
}

export const ACCESS_REQUEST_PAGE_SIZE = 20;

export async function listAccessRequests(
  ctx: AuthContext,
  params: { status?: AccessRequestStatus; q?: string; page?: number } = {},
): Promise<{ items: AccessRequestListItem[]; total: number; page: number; totalPages: number }> {
  assertReviewer(ctx);
  const q = params.q?.replace(/\s+/g, ' ').trim().slice(0, 100);
  const where: Prisma.AccessRequestWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(q
      ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q.toLowerCase() } }] }
      : {}),
  };
  const page = Number.isInteger(params.page) && params.page! > 0 ? params.page! : 1;
  const db = getDb();
  const [total, rows] = await db.$transaction([
    db.accessRequest.count({ where }),
    db.accessRequest.findMany({
      where,
      // Pending first (enum order PENDING, APPROVED, REJECTED), newest first within each.
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * ACCESS_REQUEST_PAGE_SIZE,
      take: ACCESS_REQUEST_PAGE_SIZE,
      select: {
        id: true,
        fullName: true,
        email: true,
        department: true,
        designation: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        reviewedBy: { select: { name: true } },
      },
    }),
  ]);
  return {
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), reviewedAt: r.reviewedAt?.toISOString() ?? null })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / ACCESS_REQUEST_PAGE_SIZE)),
  };
}

export type InvitationState = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface AccessRequestDetail extends AccessRequestListItem {
  reason: string;
  assignedRole: string | null;
  rejectionReason: string | null;
  /** True when an administrator account already uses this e-mail. */
  accountExists: boolean;
  invitation: {
    state: InvitationState;
    createdAt: string;
    expiresAt: string;
    createdBy: string;
    acceptedBy: { id: string; name: string } | null;
    usedAt: string | null;
  } | null;
}

function invitationState(inv: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()): InvitationState {
  if (inv.usedAt) return 'accepted';
  if (inv.revokedAt) return 'revoked';
  return inv.expiresAt.getTime() <= now.getTime() ? 'expired' : 'pending';
}

export async function getAccessRequest(ctx: AuthContext, id: unknown): Promise<AccessRequestDetail | null> {
  assertReviewer(ctx);
  const parsed = reviewIdSchema.safeParse(id);
  if (!parsed.success) return null;
  const db = getDb();
  const r = await db.accessRequest.findUnique({
    where: { id: parsed.data },
    include: {
      reviewedBy: { select: { name: true } },
      invitations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { createdBy: { select: { name: true } }, acceptedBy: { select: { id: true, name: true } } },
      },
    },
  });
  if (!r) return null;
  const account = await db.adminUser.findUnique({ where: { email: r.email }, select: { id: true } });
  const inv = r.invitations[0];
  return {
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    department: r.department,
    designation: r.designation,
    reason: r.reason,
    status: r.status,
    assignedRole: r.assignedRole,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewedBy: r.reviewedBy,
    accountExists: Boolean(account),
    invitation: inv
      ? {
          state: invitationState(inv),
          createdAt: inv.createdAt.toISOString(),
          expiresAt: inv.expiresAt.toISOString(),
          createdBy: inv.createdBy.name,
          acceptedBy: inv.acceptedBy,
          usedAt: inv.usedAt?.toISOString() ?? null,
        }
      : null,
  };
}

// ---------------------------------------------------------------- decisions --

async function loadForDecision(tx: DbTx, id: string) {
  const r = await tx.accessRequest.findUnique({ where: { id }, select: { id: true, status: true, email: true, fullName: true } });
  if (!r) throw new AdminActionError('This access request no longer exists.');
  if (r.status !== 'PENDING') {
    throw new AdminActionError(`This request has already been ${r.status === 'APPROVED' ? 'approved' : 'rejected'}.`);
  }
  return r;
}

/**
 * Approves a pending request with the chosen role and issues the invitation.
 * Returns the invitation token ONCE — only its hash is stored, so it can be
 * shown to the Super Admin now and never again.
 */
export async function approveAccessRequest(ctx: AuthContext, raw: unknown, request: RequestMeta | null): Promise<IssuedInvitation> {
  assertReviewer(ctx);
  const parsed = approveRequestSchema.safeParse(raw);
  if (!parsed.success) throw new AdminActionError(Object.values(toFieldErrors(parsed.error)).flat()[0] ?? 'Invalid request.');
  const { requestId, role } = parsed.data;
  const now = new Date();

  return getDb().$transaction(async (tx) => {
    const r = await loadForDecision(tx, requestId);
    if (await tx.adminUser.findUnique({ where: { email: r.email }, select: { id: true } })) {
      throw new AdminActionError('An administrator account already uses this email address. Reject this request instead.');
    }
    // Conditional on still being PENDING: two reviewers clicking at once cannot both win.
    const { count } = await tx.accessRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status: 'APPROVED', pendingEmail: null, assignedRole: role, reviewedById: ctx.admin.id, reviewedAt: now },
    });
    if (count === 0) throw new AdminActionError('This request was just reviewed by someone else. Reload the page.');

    const audit = { actorId: ctx.admin.id, targetType: 'access_request' as const, targetId: requestId, request };
    await recordAudit(tx, { ...audit, action: 'ACCESS_REQUEST_APPROVED', metadata: { name: r.fullName, email: r.email, role } });
    await recordAudit(tx, { ...audit, action: 'ROLE_ASSIGNED', metadata: { email: r.email, role } });
    return createInvitationTx(tx, ctx, { accessRequestId: requestId, email: r.email, name: r.fullName, role }, request, now);
  });
}

export async function rejectAccessRequest(ctx: AuthContext, raw: unknown, request: RequestMeta | null): Promise<void> {
  assertReviewer(ctx);
  const parsed = rejectRequestSchema.safeParse(raw);
  if (!parsed.success) throw new AdminActionError(Object.values(toFieldErrors(parsed.error)).flat()[0] ?? 'Invalid request.');
  const { requestId, reason } = parsed.data;

  await getDb().$transaction(async (tx) => {
    const r = await loadForDecision(tx, requestId);
    const { count } = await tx.accessRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status: 'REJECTED', pendingEmail: null, rejectionReason: reason, reviewedById: ctx.admin.id, reviewedAt: new Date() },
    });
    if (count === 0) throw new AdminActionError('This request was just reviewed by someone else. Reload the page.');
    await recordAudit(tx, {
      action: 'ACCESS_REQUEST_REJECTED',
      actorId: ctx.admin.id,
      targetType: 'access_request',
      targetId: requestId,
      metadata: { name: r.fullName, email: r.email, reason },
      request,
    });
  });
}

/**
 * A fresh invitation link for an approved request whose link was lost or has
 * expired. Any earlier unused link stops working at once.
 */
export async function regenerateInvitation(ctx: AuthContext, requestId: unknown, request: RequestMeta | null): Promise<IssuedInvitation> {
  assertReviewer(ctx);
  const parsed = reviewIdSchema.safeParse(requestId);
  if (!parsed.success) throw new AdminActionError('Unknown access request.');
  const now = new Date();

  return getDb().$transaction(async (tx) => {
    // Lock the request row so two regenerations cannot interleave.
    await tx.$queryRaw`SELECT id FROM "incworx"."access_requests" WHERE id = ${parsed.data}::uuid FOR UPDATE`;
    const r = await tx.accessRequest.findUnique({ where: { id: parsed.data }, select: { status: true, email: true, fullName: true, assignedRole: true } });
    if (!r) throw new AdminActionError('This access request no longer exists.');
    if (r.status !== 'APPROVED' || !r.assignedRole) throw new AdminActionError('Only approved requests have an invitation.');
    if (await tx.adminUser.findUnique({ where: { email: r.email }, select: { id: true } })) {
      throw new AdminActionError('The account has already been set up; no new invitation is needed.');
    }
    return createInvitationTx(
      tx,
      ctx,
      { accessRequestId: parsed.data, email: r.email, name: r.fullName, role: r.assignedRole as 'ADMIN' },
      request,
      now,
      { regenerated: true },
    );
  });
}
