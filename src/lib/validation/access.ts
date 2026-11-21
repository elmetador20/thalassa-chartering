import { z } from 'zod';
import { containsIdentity, emailSchema, IDENTITY_MESSAGE, nameSchema, newPasswordSchema } from './auth';

// ============================================================================
// Access requests and invitations. Shared by the browser (instant feedback)
// and the server (enforcement); the server always re-parses, and adds the
// dictionary-based password strength check (server-only).
// ============================================================================

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function text(label: string, min: number, max: number) {
  return z
    .string({ error: `${label} is required.` })
    .transform((v) => v.replace(/\s+/g, ' ').trim())
    .pipe(
      z
        .string()
        .min(1, { error: `${label} is required.` })
        .min(min, { error: `${label} must be at least ${min} characters.` })
        .max(max, { error: `${label} must be ${max} characters or fewer.` })
        .refine((v) => !CONTROL_CHARS.test(v), { error: `${label} contains characters that are not allowed.` }),
    );
}

/** Shown after every accepted submission — the same whatever the e-mail. */
export const ACCESS_REQUEST_CONFIRMATION =
  'Your access request has been submitted successfully. The Super Admin will review your request.';

export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 1000;

export const accessRequestSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  department: text('Company / department', 2, 160),
  designation: text('Designation', 2, 120),
  // Line breaks are kept in the reason; only other control characters are refused.
  reason: z
    .string({ error: 'Reason for access is required.' })
    .trim()
    .min(1, { error: 'Reason for access is required.' })
    .min(REASON_MIN_LENGTH, { error: `Please give a little more detail (at least ${REASON_MIN_LENGTH} characters).` })
    .max(REASON_MAX_LENGTH, { error: `Keep the reason to ${REASON_MAX_LENGTH} characters or fewer.` })
    .refine((v) => !CONTROL_CHARS.test(v), { error: 'The reason contains characters that are not allowed.' }),
});
export type AccessRequestInput = z.infer<typeof accessRequestSchema>;

/**
 * Roles a Super Admin can grant through an access request. Deliberately only
 * ADMIN: Super Admin accounts are never created from the UI (the database
 * refuses it too — see migration #4). Add a role here only together with a
 * matching database rule.
 */
export const ASSIGNABLE_ROLES = ['ADMIN'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', SUPER_ADMIN: 'Super Admin' };
export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  ADMIN: 'Upload, edit, publish and archive reports. Cannot delete reports or manage administrators.',
};

export const reviewIdSchema = z.uuid({ error: 'Unknown access request.' });

export const approveRequestSchema = z.object({
  requestId: reviewIdSchema,
  role: z.enum(ASSIGNABLE_ROLES, { error: 'Choose a role to assign.' }),
});

export const rejectRequestSchema = z.object({
  requestId: reviewIdSchema,
  reason: z
    .string()
    .nullish()
    .transform((v) => (v ?? '').trim())
    .pipe(z.string().max(500, { error: 'Keep the reason to 500 characters or fewer.' }))
    .transform((v) => v || null),
});

/** The invitation token as it appears in the link (43 base64url characters). */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Choosing a password from an invitation. `identity` is the invited person. */
export function makeAcceptInvitationSchema(identity: { name: string; email: string }) {
  return z
    .object({
      password: newPasswordSchema,
      confirmPassword: z.string({ error: 'Confirm your password.' }),
    })
    .superRefine((data, ctx) => {
      if (data.password && containsIdentity(data.password, identity)) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: IDENTITY_MESSAGE });
      }
      if (!data.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Confirm your password.' });
      else if (data.password !== data.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
    });
}
