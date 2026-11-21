import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'prisma/config';

// Load env files exactly the way Next.js does (.env, .env.local,
// .env.development…, with the same precedence), so the Prisma CLI and the app
// always read the same values. Prisma 7 no longer loads .env on its own.
loadEnvConfig(process.cwd());

/** The Postgres schema this app owns. Must match `schemas` in schema.prisma. */
const APP_SCHEMA = 'incworx';

/**
 * Pins the CLI's default schema to `incworx`, whatever connection string was
 * pasted into .env.
 *
 * Prisma keeps its migration history (`_prisma_migrations`) in the
 * connection's default schema — `public` unless told otherwise — and refuses
 * (P3005) to start a history in a default schema that already holds tables.
 * On a Supabase project with existing data in `public`, a plain connection
 * string therefore stops `migrate deploy` cold. Pointing the CLI at `incworx`
 * keeps the history next to the tables it describes, out of the schema that
 * Supabase's API exposes, and means `public` is never Prisma's concern at all.
 */
function withAppSchema(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('schema', APP_SCHEMA);
    return parsed.toString();
  } catch {
    // Not parseable as a URL (e.g. an unencoded character in the password):
    // append rather than rewrite, and let Prisma report anything malformed.
    return `${url}${url.includes('?') ? '&' : '?'}schema=${APP_SCHEMA}`;
  }
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    // The CLI (migrate, studio) needs a DIRECT / session connection; the app
    // itself talks through the pooled DATABASE_URL (src/lib/server/db.ts).
    //
    // Falls back to an empty string instead of throwing: commands that never
    // connect — `prisma generate` on install, `prisma validate` in CI — must
    // keep working on machines that have no database credentials.
    url: withAppSchema(process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ''),
  },
});
