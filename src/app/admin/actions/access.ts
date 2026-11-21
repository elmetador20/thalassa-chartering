'use server';

import { redirect } from 'next/navigation';
import { LOGIN_PATH } from '@/lib/auth/constants';
import { readFormFields, type FormState } from '@/lib/forms';
import { ACCESS_REQUEST_CONFIRMATION } from '@/lib/validation/access';
import { submitAccessRequest } from '@/lib/server/auth/access-requests';
import { getRequestMeta } from '@/lib/server/auth/guards';
import { acceptInvitation, inspectInvitation, type InspectInvitationResult } from '@/lib/server/auth/invitations';

// Public endpoints: Request Access and invitation acceptance. Next.js rejects
// server-action POSTs from another origin (CSRF); inputs are re-validated by
// the services; nothing here reveals whether an e-mail has an account.

export async function requestAccessAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const raw = readFormFields(formData, ['fullName', 'email', 'department', 'designation', 'reason', 'website']);
  const values = {
    fullName: raw.fullName.trim(),
    email: raw.email.trim(),
    department: raw.department.trim(),
    designation: raw.designation.trim(),
    reason: raw.reason.trim(),
  };

  // Honeypot: a field people never see. Bots that fill it get the normal
  // confirmation and nothing is stored.
  if (raw.website) return { status: 'success', message: ACCESS_REQUEST_CONFIRMATION };

  const result = await submitAccessRequest(values, getRequestMeta());
  if (!result.ok) return { status: 'error', fieldErrors: result.fieldErrors, message: result.message, values };
  return { status: 'success', message: ACCESS_REQUEST_CONFIRMATION };
}

export async function inspectInvitationAction(token: unknown): Promise<InspectInvitationResult> {
  return inspectInvitation(token, getRequestMeta());
}

export async function acceptInvitationAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const raw = readFormFields(formData, ['token', 'password', 'confirmPassword']);
  const result = await acceptInvitation(raw, getRequestMeta());
  if (!result.ok) return { status: 'error', fieldErrors: result.fieldErrors, message: result.message };
  redirect(`${LOGIN_PATH}?activated=1`);
}
