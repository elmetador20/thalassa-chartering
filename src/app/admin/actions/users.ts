'use server';

import { revalidatePath } from 'next/cache';
import { readFormFields, type ActionResult, type FormState } from '@/lib/forms';
import { approveAdmin, createAdmin, rejectAdmin, setAdminActive } from '@/lib/server/auth/admins';
import { AdminActionError, ForbiddenError } from '@/lib/server/auth/errors';
import { getRequestMeta, requireActionSession } from '@/lib/server/auth/guards';

// Super Admin actions. Each re-validates the session, and the service it calls
// checks the permission — an ADMIN calling these directly gets a refusal, not
// a result. Arguments are typed `unknown` on purpose: anything can arrive over
// the wire, so the services validate it with Zod.

function refresh(): void {
  revalidatePath('/admin/users');
  revalidatePath('/admin');
}

async function attempt(run: () => Promise<void>, success: string): Promise<ActionResult> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AdminActionError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
  refresh();
  return { ok: true, message: success };
}

export async function createAdminAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireActionSession();
  const raw = readFormFields(formData, ['name', 'email', 'password', 'confirmPassword']);
  const values = { name: raw.name.trim(), email: raw.email.trim() };

  try {
    const result = await createAdmin(ctx, raw, getRequestMeta());
    if (!result.ok) return { status: 'error', fieldErrors: result.fieldErrors, message: result.message, values };
    refresh();
    return { status: 'success', message: `${result.name} was added and is awaiting your approval.` };
  } catch (error) {
    if (error instanceof ForbiddenError) return { status: 'error', message: error.message };
    throw error;
  }
}

export async function approveAdminAction(adminId: unknown): Promise<ActionResult> {
  const ctx = await requireActionSession();
  return attempt(() => approveAdmin(ctx, adminId, getRequestMeta()), 'Administrator approved and activated.');
}

export async function rejectAdminAction(adminId: unknown, reason: unknown): Promise<ActionResult> {
  const ctx = await requireActionSession();
  return attempt(async () => {
    await rejectAdmin(ctx, { adminId, reason }, getRequestMeta());
  }, 'Administrator rejected. Any open sessions were ended.');
}

export async function setAdminActiveAction(adminId: unknown, active: unknown): Promise<ActionResult> {
  const ctx = await requireActionSession();
  return attempt(
    async () => {
      await setAdminActive(ctx, { adminId, active }, getRequestMeta());
    },
    active === true ? 'Administrator activated.' : 'Administrator deactivated and signed out everywhere.',
  );
}
