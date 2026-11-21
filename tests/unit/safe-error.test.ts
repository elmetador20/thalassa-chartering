import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { describeErrorSafely, redactSecrets } from '@/lib/server/safe-error';

// Fake values only — shaped like real ones so the redaction is genuinely exercised.
const DB_PASSWORD = 'Fake@Db#Pass2026';
const TYPED_PASSWORD = 'Typed-At-The-Prompt#91';
const REF = 'abcdefghijklmnopqrst';
const POOLER_URL = `postgresql://postgres.${REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;

/** Exactly the shape of the message the seed hit (captured from the real failure):
 *  blank first line, call site, a code frame WITHOUT pipes, reason last. */
const P1001_MESSAGE = [
  '',
  'Invalid `prisma.adminUser.findFirst()` invocation in',
  'D:\\incworx\\thalassa-chartering\\src\\lib\\server\\auth\\seed.ts:34:28',
  '',
  '  31   const { name, email, password } = parsed.data;',
  '  32',
  '  33   const db = getDb();',
  '→ 34   if (await db.adminUser.findFirst(',
  `Can't reach database server at db.${REF}.supabase.co`,
].join('\n');

const saved = { DATABASE_URL: process.env.DATABASE_URL };
beforeEach(() => {
  process.env.DATABASE_URL = POOLER_URL;
});
afterEach(() => {
  process.env.DATABASE_URL = saved.DATABASE_URL;
});

describe('describeErrorSafely', () => {
  const p1001 = () => new Prisma.PrismaClientKnownRequestError(P1001_MESSAGE, { code: 'P1001', clientVersion: '7.10.1' });

  it('the old handler printed nothing: the first line of a Prisma message is blank', () => {
    expect(p1001().message.split('\n')[0]).toBe('');
  });

  it('keeps the type, the Prisma code and the actual reason', () => {
    const text = describeErrorSafely(p1001());
    expect(text).toContain('PrismaClientKnownRequestError P1001');
    expect(text).toContain("Can't reach database server at db.");
  });

  it('adds an actionable hint for the code', () => {
    expect(describeErrorSafely(p1001())).toMatch(/Hint: .*Transaction pooler.*6543/);
  });

  it('drops the code frame and call site, leaving just the reason', () => {
    const text = describeErrorSafely(p1001());
    expect(text).not.toContain('parsed.data');
    expect(text).not.toContain('getDb()');
    expect(text).not.toContain('Invalid `prisma');
    expect(text).not.toContain('seed.ts:34:28');
    expect(text.split(' — Hint:')[0]).toBe(`PrismaClientKnownRequestError P1001: Can't reach database server at db.${REF}.supabase.co`);
  });

  it('also drops piped code frames ("41 | …")', () => {
    const piped = new Prisma.PrismaClientKnownRequestError('\n  41 | const x = 1;\n→ 42 | await y();\nThe table `incworx.admin_users` does not exist', { code: 'P2021', clientVersion: '7.10.1' });
    expect(describeErrorSafely(piped)).toMatch(/^PrismaClientKnownRequestError P2021: The table `incworx.admin_users` does not exist — Hint: .*db:deploy/);
  });

  it('redacts connection strings, env passwords, the typed password, hashes and tokens', () => {
    const leaky = new Error(
      [
        `connect failed for ${POOLER_URL}`,
        `password=${DB_PASSWORD} (raw) / ${encodeURIComponent(DB_PASSWORD)} (encoded)`,
        `typed ${TYPED_PASSWORD}`,
        'hash $argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA',
        `token ${'A'.repeat(43)}, token hash ${'f'.repeat(64)}`,
      ].join('\n'),
    );
    const text = describeErrorSafely(leaky, [TYPED_PASSWORD]);
    for (const secret of [DB_PASSWORD, encodeURIComponent(DB_PASSWORD), TYPED_PASSWORD, POOLER_URL, '$argon2id$', 'A'.repeat(43), 'f'.repeat(64)]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain('[redacted]');
  });

  it('bounds the length', () => {
    expect(describeErrorSafely(new Error('x'.repeat(5000))).length).toBeLessThanOrEqual(600);
  });

  it('handles non-Error throws', () => {
    expect(describeErrorSafely(`boom with ${POOLER_URL}`)).not.toContain(DB_PASSWORD);
    expect(describeErrorSafely(undefined)).toBe('unknown error');
  });
});

describe('redactSecrets', () => {
  it('leaves ordinary diagnostic text alone', () => {
    expect(redactSecrets('The table `incworx.admin_users` does not exist')).toBe('The table `incworx.admin_users` does not exist');
  });
});
