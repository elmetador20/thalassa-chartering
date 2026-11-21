import 'server-only';
import { argon2id, hash, needsRehash, verify } from 'argon2';

// ============================================================================
// Password hashing — Argon2id.
//
// 64 MiB, 3 passes, 1 lane: ~170 ms per verification on a typical dev
// machine, about 4.5x the cost of OWASP's minimum (19 MiB / 2 passes), which
// matters if the hashes ever leak and are attacked offline. One lane keeps the
// cost predictable on serverless CPUs, where extra threads would only contend.
//
// Passwords are NFKC-normalised first, so the same password typed on two
// devices that encode accents differently still verifies.
// ============================================================================

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 64 * 1024, // KiB
  timeCost: 3,
  parallelism: 1,
} as const;

const normalise = (password: string) => password.normalize('NFKC');

export function hashPassword(password: string): Promise<string> {
  return hash(normalise(password), ARGON2_OPTIONS);
}

/** Never throws: a malformed stored hash simply fails verification. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, normalise(password));
  } catch {
    return false;
  }
}

/** True when a stored hash was made with weaker parameters than today's, so it
 *  can be upgraded transparently at the next successful sign-in. */
export function passwordNeedsRehash(passwordHash: string): boolean {
  try {
    return needsRehash(passwordHash, ARGON2_OPTIONS);
  } catch {
    return true;
  }
}

let timingHash: Promise<string> | null = null;

/**
 * Runs a full verification against a throwaway hash. Called when the e-mail
 * matches no account, so "no such account" takes as long as "wrong password"
 * and response timing cannot be used to discover which e-mails exist.
 */
export async function equaliseVerificationTime(password: string): Promise<void> {
  timingHash ??= hashPassword('incworx-timing-equaliser-not-a-real-account');
  await verifyPassword(await timingHash, password);
}
