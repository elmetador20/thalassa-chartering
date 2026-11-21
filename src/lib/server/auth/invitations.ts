import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { AssignableRole } from '@/lib/validation/access';
import { invitationTokenSchema, makeAcceptInvitationSchema } from '@/lib/validation/access';
import { passwordRuleProblems, toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import { recordAudit, type RequestMeta } from '../audit';
import { getDb, type DbTx } from '../db';
import { hashPassword } from './password';
import { passwordStrengthProblem } from './password-strength';
import { checkRateLimit, INVITATION_RATE_LIMIT, ipKey, recordFailure } from './rate-limit';
import type { AuthContext } from './session';

// ============================================================================
// Invitations: how an approved access request becomes an account.
//
//   - 256-bit random token; only its SHA-256 is stored (a database leak yields
//     no usable links). The raw token is returned once, to the approving
//     Super Admin, and never logged.
//   - Valid for 24 hours, single use, revocable (issuing a new one revokes the
//     old). The database refuses to alter an invitation or reuse a used one.
//   - Name, e-mail and role are fixed on the invitation at approval time.
//     The link carries only the token, so nothing in it can change who the
//     account is for or what it may do.
//   - The account is created at acceptance, with the password the invited
//     person chooses — there is never an account with a placeholder password.
//
// The link puts the token in the URL fragment (`#token=…`). Browsers never
// send fragments to the server, so the token cannot appear in server or proxy
// access logs or Referer headers; the page reads it and POSTs it.
// ============================================================================

export const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
export const INVITATION_PATH = '/accept-invitation';

const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

export interface IssuedInvitation {
  /** Shown once to the Super Admin; build the link as `${origin}${INVITATION_PATH}#token=${token}`. */
  token: string;
  expiresAt: string;
  email: string;
}

/** Inside the approving transaction: revoke any open link, issue a new one. */
export async function createInvitationTx(
  tx: DbTx,
  ctx: AuthContext,
  input: { accessRequestId: string; email: string; name: string; role: AssignableRole },
  request: RequestMeta | null,
  now: Date,
  meta: { regenerated?: boolean } = {},
): Promise<IssuedInvitation> {
  await tx.adminInvitation.updateMany({
    where: { accessRequestId: input.accessRequestId, usedAt: null, revokedAt: null },
    data: { revokedAt: now },
  });
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
  const invitation = await tx.adminInvitation.create({
    data: {
      accessRequestId: input.accessRequestId,
      email: input.email,
      name: input.name,
      role: input.role,
      tokenHash: hashToken(token),
      expiresAt,
      createdById: ctx.admin.id,
      createdAt: now,
    },
    select: { id: true },
  });
  await recordAudit(tx, {
    action: 'INVITATION_CREATED',
    actorId: ctx.admin.id,
    targetType: 'access_request',
    targetId: input.accessRequestId,
    metadata: { invitationId: invitation.id, email: input.email, role: input.role, expiresAt: expiresAt.toISOString(), regenerated: Boolean(meta.regenerated) },
    request,
  });
  return { token, expiresAt: expiresAt.toISOString(), email: input.email };
}

// ------------------------------------------------------------------ public --

const INVALID_MESSAGE = 'This invitation link is invalid, has expired or has already been used. Ask the Super Admin for a new link.';

type Lookup =
  | { ok: true; invitation: { id: string; accessRequestId: string; email: string; name: string; role: 'ADMIN' | 'SUPER_ADMIN'; createdById: string; expiresAt: Date } }
  | { ok: false; message: string };

async function findUsableInvitation(rawToken: unknown, request: RequestMeta | null, now: Date): Promise<Lookup> {
  const ipRule = { key: `invitation:${ipKey(request?.ipAddress ?? null)}`, ...INVITATION_RATE_LIMIT };
  if ((await checkRateLimit([ipRule], now)).limited) {
    return { ok: false, message: 'Too many attempts. Please wait a few minutes and try again.' };
  }
  const parsed = invitationTokenSchema.safeParse(rawToken);
  const invitation = parsed.success
    ? await getDb().adminInvitation.findUnique({
        where: { tokenHash: hashToken(parsed.data) },
        select: {
          id: true,
          accessRequestId: true,
          email: true,
          name: true,
          role: true,
          createdById: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
          accessRequest: { select: { status: true } },
        },
      })
    : null;
  const usable =
    invitation && !invitation.usedAt && !invitation.revokedAt && invitation.expiresAt.getTime() > now.getTime() && invitation.accessRequest.status === 'APPROVED';
  if (!usable) {
    await recordFailure([ipRule], now);
    return { ok: false, message: INVALID_MESSAGE };
  }
  return { ok: true, invitation };
}

export type InspectInvitationResult =
  | { ok: true; name: string; email: string; role: string; expiresAt: string }
  | { ok: false; message: string };

/** What the acceptance page shows before the password is chosen. */
export async function inspectInvitation(token: unknown, request: RequestMeta | null): Promise<InspectInvitationResult> {
  const found = await findUsableInvitation(token, request, new Date());
  if (!found.ok) return found;
  const { name, email, role, expiresAt } = found.invitation;
  return { ok: true, name, email, role, expiresAt: expiresAt.toISOString() };
}

export type AcceptInvitationResult = { ok: true; email: string } | { ok: false; message?: string; fieldErrors?: FieldErrors };

export async function acceptInvitation(
  raw: { token: unknown; password: unknown; confirmPassword: unknown },
  request: RequestMeta | null,
): Promise<AcceptInvitationResult> {
  const now = new Date();
  const found = await findUsableInvitation(raw.token, request, now);
  if (!found.ok) return found;
  const inv = found.invitation;

  // The existing password policy, identity rule and (server-only) strength check.
  const identity = { name: inv.name, email: inv.email };
  const parsed = makeAcceptInvitationSchema(identity).safeParse({ password: raw.password, confirmPassword: raw.confirmPassword });
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) };
  if (passwordRuleProblems(parsed.data.password).length === 0) {
    const weak = await passwordStrengthProblem(parsed.data.password, identity);
    if (weak) return { ok: false, fieldErrors: { password: [weak] } };
  }
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    await getDb().$transaction(async (tx) => {
      if (await tx.adminUser.findUnique({ where: { email: inv.email }, select: { id: true } })) throw new AccountExists();
      // Role, name and e-mail come from the invitation row — never from the request.
      const admin = await tx.adminUser.create({
        data: {
          name: inv.name,
          email: inv.email,
          passwordHash,
          role: inv.role,
          approvalStatus: 'APPROVED',
          isActive: true,
          approvedById: inv.createdById,
          approvedAt: now,
        },
        select: { id: true },
      });
      // Claim the invitation: only succeeds if it is still unused, unrevoked
      // and unexpired. A simultaneous second use finds nothing to claim (or
      // collides on the unique e-mail above) and rolls back.
      const { count } = await tx.adminInvitation.updateMany({
        where: { id: inv.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now, acceptedById: admin.id },
      });
      if (count !== 1) throw new InvitationGone();
      await recordAudit(tx, {
        action: 'INVITATION_ACCEPTED',
        actorId: admin.id,
        targetType: 'access_request',
        targetId: inv.accessRequestId,
        metadata: { invitationId: inv.id, adminUserId: admin.id, email: inv.email, role: inv.role },
        request,
      });
    });
  } catch (error) {
    if (error instanceof InvitationGone || (error as { code?: string })?.code === 'P2002') return { ok: false, message: INVALID_MESSAGE };
    if (error instanceof AccountExists) {
      return { ok: false, message: 'An account for this email address already exists. Sign in instead, or ask the Super Admin for help.' };
    }
    throw error;
  }
  return { ok: true, email: inv.email };
}

class InvitationGone extends Error {}
class AccountExists extends Error {}
