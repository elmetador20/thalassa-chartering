'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/forms';
import { approveAccessRequest, regenerateInvitation, rejectAccessRequest } from '@/lib/server/auth/access-requests';
import { AdminActionError, ForbiddenError } from '@/lib/server/auth/errors';
import { getRequestMeta, requireActionSession } from '@/lib/server/auth/guards';

// Super Admin review of access requests. Each action re-validates the session;
// the service checks the `access-requests:review` permission, so an ADMIN
// calling these directly gets a refusal. Arguments are `unknown` on purpose:
// the services validate them.

export type InvitationResult = { ok: true; message: string; token: string; expiresAt: string; email: string } | { ok: false; message: string };

function refresh(id?: string): void {
  revalidatePath('/admin', 'layout'); // pending count in the navigation and dashboard
  revalidatePath('/admin/access-requests');
  if (id) revalidatePath(`/admin/access-requests/${id}`);
}

function refusal(error: unknown): { ok: false; message: string } {
  if (error instanceof ForbiddenError || error instanceof AdminActionError) return { ok: false, message: error.message };
  throw error;
}

export async function approveAccessRequestAction(requestId: unknown, role: unknown): Promise<InvitationResult> {
  const ctx = await requireActionSession();
  try {
    const issued = await approveAccessRequest(ctx, { requestId, role }, getRequestMeta());
    refresh(typeof requestId === 'string' ? requestId : undefined);
    return { ok: true, message: 'Request approved. Send the invitation link below to the requester.', ...issued };
  } catch (error) {
    return refusal(error);
  }
}

export async function rejectAccessRequestAction(requestId: unknown, reason: unknown): Promise<ActionResult> {
  const ctx = await requireActionSession();
  try {
    await rejectAccessRequest(ctx, { requestId, reason }, getRequestMeta());
    refresh(typeof requestId === 'string' ? requestId : undefined);
    return { ok: true, message: 'Request rejected. No account was created.' };
  } catch (error) {
    return refusal(error);
  }
}

export async function regenerateInvitationAction(requestId: unknown): Promise<InvitationResult> {
  const ctx = await requireActionSession();
  try {
    const issued = await regenerateInvitation(ctx, requestId, getRequestMeta());
    refresh(typeof requestId === 'string' ? requestId : undefined);
    return { ok: true, message: 'New invitation link generated. Any earlier link no longer works.', ...issued };
  } catch (error) {
    return refusal(error);
  }
}
