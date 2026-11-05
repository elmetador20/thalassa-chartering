import 'server-only';

// ============================================================================
// Safe error descriptions for logs and command-line output.
//
// Keeps what diagnoses a problem — error type, Prisma / driver code, the
// human-readable reason, a hint — and removes anything secret: connection
// strings, passwords, password hashes and session tokens.
//
// Prisma messages begin with a blank line and an "Invalid `prisma.x()`
// invocation" code frame, with the real reason at the end. Printing only the
// first line therefore prints nothing at all, which is exactly how the seed
// used to fail with a bare "Seed failed:".
// ============================================================================

const REDACTED = '[redacted]';
const MAX_LENGTH = 600;

/** Env vars whose values (and embedded passwords) must never be echoed. */
const SECRET_ENV_KEYS = ['DATABASE_URL', 'DIRECT_URL', 'R2_SECRET_ACCESS_KEY', 'R2_ACCESS_KEY_ID', 'SUPER_ADMIN_PASSWORD'];

const HINTS: Record<string, string> = {
  P1000:
    'The database rejected the credentials. Check the password in DATABASE_URL / DIRECT_URL, and that special characters are URL-encoded (@ as %40).',
  P1001:
    'The database server is unreachable. On Supabase, DATABASE_URL must be the Transaction pooler (postgres.<project-ref>@aws-0-<region>.pooler.supabase.com:6543), not db.<project-ref>.supabase.co, which is IPv6-only.',
  P1002: 'The database server timed out. Check the network and that the pooler host and port are right.',
  P1017: 'The database closed the connection. Retry; if it persists, check the pooler mode and port.',
  P2021: 'A table is missing — the migrations have not been applied. Run `npm run db:deploy`.',
  P2022: 'A column is missing — the database is behind the schema. Run `npm run db:deploy`.',
};

function secretValues(extra: readonly string[]): string[] {
  const values = new Set<string>();
  const add = (v: string | undefined | null) => {
    if (v && v.length >= 4) values.add(v);
  };
  for (const key of SECRET_ENV_KEYS) {
    const value = process.env[key];
    add(value);
    try {
      const url = new URL(value ?? '');
      add(url.password);
      add(decodeURIComponent(url.password));
    } catch {
      // not a URL
    }
  }
  extra.forEach(add);
  // Longest first, so a full value is redacted before a substring of it.
  return [...values].sort((a, b) => b.length - a.length);
}

/** Removes secrets from arbitrary text. */
export function redactSecrets(text: string, extraSecrets: readonly string[] = []): string {
  let out = text;
  for (const secret of secretValues(extraSecrets)) out = out.split(secret).join(REDACTED);
  return out
    .replace(/\b(postgres(?:ql)?|prisma\+postgres):\/\/\S+/gi, `$1://${REDACTED}`) // connection strings
    .replace(/\$argon2(?:id|i|d)\$\S+/g, REDACTED) // password hashes
    .replace(/\b[a-f0-9]{64}\b/gi, REDACTED) // session-token hashes
    .replace(/\b[A-Za-z0-9_-]{43}\b/g, REDACTED); // raw session tokens (32 bytes, base64url)
}

/** Drops Prisma's code frame and call-site noise, keeping the actual reason. */
function meaningfulLines(message: string): string[] {
  return message
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !/^(?:→\s*)?\d{1,5}(?:\s|\||$)/.test(line) && // code-frame lines: "8 const …", "→ 11   await …", "41 | …"
        !/^Invalid `[^`]+` invocation/.test(line) &&
        !/^(?:[A-Za-z]:\\|\/)[^\s]*:\d+:\d+$/.test(line), // bare "D:\…\file.ts:24:43" call sites
    );
}

/**
 * One safe line describing `error`, e.g.
 * "PrismaClientKnownRequestError P1001: Can't reach database server at … — Hint: …"
 */
export function describeErrorSafely(error: unknown, extraSecrets: readonly string[] = []): string {
  if (!(error instanceof Error)) return redactSecrets(String(error ?? 'unknown error'), extraSecrets).slice(0, MAX_LENGTH);

  const rawCode = (error as Error & { code?: unknown }).code;
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  const reason = meaningfulLines(error.message).join(' ') || error.name;
  const hint = code ? HINTS[code] : undefined;
  const text = `${error.constructor?.name ?? error.name}${code ? ` ${code}` : ''}: ${reason}${hint ? ` — Hint: ${hint}` : ''}`;
  return redactSecrets(text, extraSecrets).slice(0, MAX_LENGTH);
}
