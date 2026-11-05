import 'server-only';
import type { ZxcvbnFactory as ZxcvbnFactoryType } from '@zxcvbn-ts/core';
import {
  createAdminSchema,
  identityTokens,
  makeChangePasswordSchema,
  passwordRuleProblems,
  type PasswordIdentity,
} from '@/lib/validation/auth';

// ============================================================================
// Server-side password strength — the part of the policy the browser never
// runs, because its word lists are ~800 KB gzipped.
//
// zxcvbn-ts (maintained) estimates how many guesses a cracker would need,
// using a 40,000-entry common-password list, English names and words, and
// pattern detection: dates, repeats, sequences, keyboard walks, l33t-speak.
//
// Score 4 (>= 10^10 guesses) is required. Measured before choosing it: every
// example in the specification scores 4, as does any random 12-character
// password; passwords that satisfy every character rule but are still
// predictable — "Summer2026!!", "Michael#2026!", "Admin@123456" — score 3.
// ============================================================================

const REQUIRED_SCORE = 4;

let factory: Promise<ZxcvbnFactoryType> | null = null;

/** Loaded on first use, so only the requests that check a new password pay
 *  the cost of parsing the dictionaries. */
function getZxcvbn(): Promise<ZxcvbnFactoryType> {
  factory ??= (async () => {
    const [{ ZxcvbnFactory }, common, en] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ]);
    return new ZxcvbnFactory({
      dictionary: { ...common.dictionary, ...en.dictionary },
      graphs: common.adjacencyGraphs,
      translations: en.translations,
    });
  })();
  return factory;
}

/**
 * Null when the password is strong enough; otherwise a user-facing reason.
 * The account's own name and e-mail are fed in as extra dictionary words.
 */
export async function passwordStrengthProblem(
  password: string,
  identity: PasswordIdentity,
): Promise<string | null> {
  const zxcvbn = await getZxcvbn();
  const result = await zxcvbn.check(password, identityTokens(identity));
  if (result.score >= REQUIRED_SCORE) return null;

  const warning = result.feedback.warning?.trim();
  const base = 'This password is too easy to guess';
  return warning ? `${base}: ${warning.replace(/\.$/, '')}.` : `${base}. Use a longer, less predictable password.`;
}

// Server schemas: the shared schemas plus the strength check. The strength
// check only runs once the structural rules pass, so the user sees one clear
// problem at a time rather than a wall of overlapping messages.

export const createAdminServerSchema = createAdminSchema.superRefine(async (data, ctx) => {
  if (passwordRuleProblems(data.password).length > 0) return;
  const problem = await passwordStrengthProblem(data.password, { name: data.name, email: data.email });
  if (problem) ctx.addIssue({ code: 'custom', path: ['password'], message: problem });
});

export function makeChangePasswordServerSchema(identity: PasswordIdentity) {
  return makeChangePasswordSchema(identity).superRefine(async (data, ctx) => {
    if (passwordRuleProblems(data.newPassword).length > 0) return;
    const problem = await passwordStrengthProblem(data.newPassword, identity);
    if (problem) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: problem });
  });
}
