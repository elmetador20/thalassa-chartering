import { z } from 'zod';

// ============================================================================
// Validation for every authentication input.
//
// Runs in the browser (instant feedback) AND on the server (enforcement), from
// this one module. The browser is a convenience only: every server action
// re-parses its input with these schemas, plus the dictionary-based strength
// check in src/lib/server/auth/password-strength.ts, which is server-only
// because its word lists are ~800 KB gzipped.
// ============================================================================

export const EMAIL_MAX_LENGTH = 254; // RFC 5321 path limit
export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 120;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
/** Sign-in accepts anything up to this, so older accounts still work, but it
 *  bounds the work an attacker can make the password hasher do. */
export const LOGIN_PASSWORD_MAX_LENGTH = 256;
export const REJECTION_REASON_MAX_LENGTH = 500;

// ------------------------------------------------------------------- email --

/** Trimmed, lower-cased, length-bounded and well-formed. Lower-casing here is
 *  what makes storage and comparison case-insensitive everywhere. */
export const emailSchema = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .min(1, { error: 'Email is required.' })
  .max(EMAIL_MAX_LENGTH, { error: `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.` })
  .pipe(z.email({ error: 'Enter a valid email address.' }));

// -------------------------------------------------------------------- name --

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’ .-]*$/u;

export const nameSchema = z
  .string({ error: 'Name is required.' })
  .trim()
  .min(1, { error: 'Name is required.' })
  .min(NAME_MIN_LENGTH, { error: `Name must be at least ${NAME_MIN_LENGTH} characters.` })
  .max(NAME_MAX_LENGTH, { error: `Name must be ${NAME_MAX_LENGTH} characters or fewer.` })
  .regex(NAME_PATTERN, { error: 'Use letters, spaces, apostrophes, hyphens and full stops only.' });

// ---------------------------------------------------------- password rules --

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
const SEQUENCE_LENGTH = 4;

const isLetter = (c: string) => c >= 'a' && c <= 'z';
const isDigit = (c: string) => c >= '0' && c <= '9';

/** True if `s` is one straight run of letters or of digits, stepping by `step`. */
function isStraightRun(s: string, step: 1 | -1): boolean {
  for (let j = 1; j < s.length; j++) {
    const a = s[j - 1];
    const b = s[j];
    const sameClass = (isLetter(a) && isLetter(b)) || (isDigit(a) && isDigit(b));
    if (!sameClass || b.charCodeAt(0) - a.charCodeAt(0) !== step) return false;
  }
  return true;
}

/** 'abcd', 'dcba', '1234', '9876' and keyboard runs like 'qwer' or 'lkjh'. */
function hasPredictableSequence(password: string): boolean {
  const lower = password.toLowerCase();

  for (let i = 0; i + SEQUENCE_LENGTH <= lower.length; i++) {
    const window = lower.slice(i, i + SEQUENCE_LENGTH);
    if (isStraightRun(window, 1) || isStraightRun(window, -1)) return true;
  }

  for (const row of KEYBOARD_ROWS) {
    const reversed = [...row].reverse().join('');
    for (let i = 0; i + SEQUENCE_LENGTH <= row.length; i++) {
      if (lower.includes(row.slice(i, i + SEQUENCE_LENGTH))) return true;
      if (lower.includes(reversed.slice(i, i + SEQUENCE_LENGTH))) return true;
    }
  }
  return false;
}

/**
 * Every policy rule a password breaks, as user-facing messages. Structural
 * rules only — the server adds a dictionary/pattern strength estimate on top.
 */
export function passwordRuleProblems(password: string): string[] {
  if (password.length === 0) return ['Password is required.'];

  const problems: string[] = [];
  const length = [...password].length; // code points, not UTF-16 units

  if (length < PASSWORD_MIN_LENGTH) problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (length > PASSWORD_MAX_LENGTH) problems.push(`Use ${PASSWORD_MAX_LENGTH} characters or fewer.`);
  if (!/\p{Ll}/u.test(password)) problems.push('Include at least one lowercase letter.');
  if (!/\p{Lu}/u.test(password)) problems.push('Include at least one uppercase letter.');
  if (!/\p{Nd}/u.test(password)) problems.push('Include at least one number.');
  if (!/[^\p{L}\p{N}\s]/u.test(password)) {
    problems.push('Include at least one special character, such as ! @ # $ or %.');
  }
  if (/([\s\S])\1{3,}/u.test(password)) {
    problems.push("Don't repeat the same character 4 or more times in a row.");
  } else if (/^([\s\S]{1,6})\1+$/u.test(password)) {
    problems.push("Don't build the password from one short repeated pattern.");
  }
  if (hasPredictableSequence(password)) {
    problems.push("Avoid sequences such as 'abcd', '1234' or 'qwer'.");
  }
  return problems;
}

export interface PasswordIdentity {
  name?: string | null;
  email?: string | null;
}

const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;
const IDENTITY_TOKEN_MIN = 3;

/** The account's name, e-mail and e-mail local part, as lower-case tokens.
 *  The domain is deliberately excluded: it is shared by the whole company. */
export function identityTokens({ name, email }: PasswordIdentity): string[] {
  const tokens = new Set<string>();
  const add = (value: string) => {
    const v = value.toLowerCase().trim();
    if (v.length >= IDENTITY_TOKEN_MIN) tokens.add(v);
  };

  const normalisedEmail = (email ?? '').trim().toLowerCase();
  if (normalisedEmail) {
    add(normalisedEmail);
    const local = normalisedEmail.split('@')[0] ?? '';
    add(local);
    local.split(TOKEN_SPLIT).forEach(add);
  }
  const normalisedName = (name ?? '').trim().toLowerCase();
  if (normalisedName) {
    normalisedName.split(TOKEN_SPLIT).forEach(add);
    add(normalisedName.replace(TOKEN_SPLIT, ''));
  }
  return [...tokens];
}

/** True if the password contains the account's name or e-mail, ignoring
 *  case and any separators the user might have added ("Ravi.Kumar"). */
export function containsIdentity(password: string, identity: PasswordIdentity): boolean {
  const lower = password.toLowerCase();
  const compact = lower.replace(new RegExp(TOKEN_SPLIT, 'gu'), '');
  return identityTokens(identity).some((token) => {
    const compactToken = token.replace(new RegExp(TOKEN_SPLIT, 'gu'), '');
    return lower.includes(token) || (compactToken.length >= IDENTITY_TOKEN_MIN && compact.includes(compactToken));
  });
}

export const IDENTITY_MESSAGE = "Don't include your name or email address.";

/** A new password: every structural rule, one issue per broken rule. */
export const newPasswordSchema = z
  .string({ error: 'Password is required.' })
  .superRefine((password, ctx) => {
    for (const message of passwordRuleProblems(password)) {
      ctx.addIssue({ code: 'custom', message });
    }
  });

// ------------------------------------------------------------------ schemas --

/**
 * Sign-in checks shape only — a well-formed e-mail and a non-empty password —
 * never the current creation policy. An account created under an older or
 * different policy must still be able to sign in.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: 'Password is required.' })
    .min(1, { error: 'Password is required.' })
    .max(LOGIN_PASSWORD_MAX_LENGTH, { error: 'Password is too long.' }),
});

/** Super Admin creating an administrator. */
export const createAdminSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string({ error: 'Confirm the password.' }),
  })
  .superRefine((data, ctx) => {
    if (data.password && containsIdentity(data.password, { name: data.name, email: data.email })) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: IDENTITY_MESSAGE });
    }
    if (!data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Confirm the password.' });
    } else if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
    }
  });

/**
 * Changing one's own password. Built per account, because the identity rule
 * needs the account's own name and e-mail — from the session on the server,
 * from props in the browser.
 */
export function makeChangePasswordSchema(identity: PasswordIdentity) {
  return z
    .object({
      currentPassword: z
        .string({ error: 'Enter your current password.' })
        .min(1, { error: 'Enter your current password.' })
        .max(LOGIN_PASSWORD_MAX_LENGTH, { error: 'Password is too long.' }),
      newPassword: newPasswordSchema,
      confirmPassword: z.string({ error: 'Confirm your new password.' }),
    })
    .superRefine((data, ctx) => {
      if (data.newPassword && containsIdentity(data.newPassword, identity)) {
        ctx.addIssue({ code: 'custom', path: ['newPassword'], message: IDENTITY_MESSAGE });
      }
      if (data.newPassword && data.newPassword === data.currentPassword) {
        ctx.addIssue({
          code: 'custom',
          path: ['newPassword'],
          message: 'Choose a password different from your current one.',
        });
      }
      if (!data.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Confirm your new password.' });
      } else if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
      }
    });
}

export const adminIdSchema = z.uuid({ error: 'Unknown administrator.' });

export const rejectAdminSchema = z.object({
  adminId: adminIdSchema,
  reason: z
    .string()
    .trim()
    .max(REJECTION_REASON_MAX_LENGTH, {
      error: `Keep the reason to ${REJECTION_REASON_MAX_LENGTH} characters or fewer.`,
    })
    .optional()
    .transform((value) => (value ? value : null)),
});

export const setAdminActiveSchema = z.object({
  adminId: adminIdSchema,
  active: z.boolean(),
});

// ----------------------------------------------------------------- helpers --

export type FieldErrors = Partial<Record<string, string[]>>;

/** Zod error → `{ field: [messages] }` for forms. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
