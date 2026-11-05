import 'server-only';
import { createHash } from 'node:crypto';
import { getDb } from '../db';

// ============================================================================
// Rate limiting for authentication, backed by Postgres (no extra service).
//
// Only FAILURES are recorded, under hashed keys. A key is limited once it has
// `max` failures inside the sliding `windowMs`. The check runs BEFORE the
// password is verified, so a locked key costs the attacker a round trip and
// the server nothing — no hashing work at all.
// ============================================================================

export interface RateLimitRule {
  /** e.g. 'email:ops@incworx.in', 'ip:203.0.113.7' — hashed before storage. */
  key: string;
  max: number;
  windowMs: number;
}

const MINUTE = 60 * 1000;

export const LOGIN_RATE_LIMITS = {
  /** Per account: stops guessing one admin's password. */
  perEmail: { max: 5, windowMs: 15 * MINUTE },
  /** Per client IP: stops one source spraying many accounts. */
  perIp: { max: 20, windowMs: 15 * MINUTE },
} as const;

/** Current-password checks when changing a password, per account. */
export const PASSWORD_CHANGE_RATE_LIMIT = { max: 5, windowMs: 15 * MINUTE } as const;

/** Upload URLs issued, per admin. Generous enough for a day of back-filling
 *  historical reports one after another; stops a stolen session flooding
 *  the bucket. Every issued URL counts, not only failures. */
export const REPORT_UPLOAD_RATE_LIMIT = { max: 60, windowMs: 10 * MINUTE } as const;

const RETENTION_MS = 24 * 60 * MINUTE;

const hashKey = (key: string) => createHash('sha256').update(key, 'utf8').digest('hex');

export interface RateLimitStatus {
  limited: boolean;
  /** Milliseconds until the oldest counted failure leaves the window. */
  retryAfterMs: number;
}

export async function checkRateLimit(rules: RateLimitRule[], now: Date = new Date()): Promise<RateLimitStatus> {
  const db = getDb();
  let retryAfterMs = 0;

  for (const rule of rules) {
    const windowStart = new Date(now.getTime() - rule.windowMs);
    const recent = await db.authAttempt.findMany({
      where: { keyHash: hashKey(rule.key), createdAt: { gt: windowStart } },
      orderBy: { createdAt: 'desc' },
      take: rule.max,
      select: { createdAt: true },
    });
    if (recent.length >= rule.max) {
      // The window reopens when the oldest of the last `max` failures expires.
      const oldest = recent[recent.length - 1].createdAt.getTime();
      retryAfterMs = Math.max(retryAfterMs, oldest + rule.windowMs - now.getTime());
    }
  }
  return { limited: retryAfterMs > 0, retryAfterMs };
}

export async function recordFailure(rules: RateLimitRule[], now: Date = new Date()): Promise<void> {
  const db = getDb();
  await db.authAttempt.createMany({
    data: rules.map((rule) => ({ keyHash: hashKey(rule.key), createdAt: now })),
  });
  // Opportunistic pruning keeps the table small without a scheduled job.
  await db.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } } });
}

/**
 * Count-every-use limiter (e.g. upload URLs): refuses once the window is
 * full, otherwise records this use. Shares the attempts table with the
 * failure counters, under a distinct key prefix.
 */
export async function consumeRateLimit(rule: RateLimitRule, now: Date = new Date()): Promise<RateLimitStatus> {
  const status = await checkRateLimit([rule], now);
  if (!status.limited) await recordFailure([rule], now);
  return status;
}

/** A successful sign-in forgives that account's earlier failures (the
 *  per-IP counter is left alone, so it still limits a spraying source). */
export async function clearFailures(key: string): Promise<void> {
  await getDb().authAttempt.deleteMany({ where: { keyHash: hashKey(key) } });
}

export function emailKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}

export function ipKey(ip: string | null): string {
  return `ip:${ip ?? 'unknown'}`;
}
