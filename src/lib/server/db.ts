import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ITXClientDenyList } from '@prisma/client/runtime/client';
import { PrismaClient } from '@/generated/prisma/client';

// ============================================================================
// Database client.
//
// `server-only` makes any attempt to import this from a Client Component fail
// the build — nearly every component in this project is 'use client', so the
// guard is worth having.
//
// The app connects through DATABASE_URL — on Supabase, the pooled
// "transaction" connection string — so serverless instances share a small
// pool instead of each opening its own connections. Migrations use the direct
// DIRECT_URL instead (see prisma.config.ts).
// ============================================================================

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Add the pooled Supabase connection string to .env — see .env.example.',
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Password hashes never leave the data layer by accident: they are omitted
    // from every query unless a caller opts in with `omit: { passwordHash: false }`,
    // which only the sign-in code should ever do.
    omit: { adminUser: { passwordHash: true } },
  });
}

export type Db = ReturnType<typeof createClient>;

/** What an interactive transaction receives. Services take this type, so they
 *  work both standalone (pass the client) and inside a caller's transaction. */
export type DbTx = Omit<Db, ITXClientDenyList>;

// One client per process. Cached on globalThis so that dev-mode hot reloads,
// which re-evaluate modules, don't open a fresh pool on every save.
const globalForDb = globalThis as unknown as { incworxDb?: Db; incworxDbClass?: typeof PrismaClient };

/**
 * The shared database client, created on first use.
 *
 * Lazy on purpose: merely importing a module that uses the database must not
 * throw, so builds and pages that never query stay independent of credentials.
 */
export function getDb(): Db {
  // After `prisma generate`, a dev-mode hot reload brings in a new PrismaClient
  // class, but globalThis still holds an instance of the old one — which knows
  // nothing about newly added models (`db.newModel` is undefined). Replace it.
  // In production the module loads once, so this never triggers.
  if (globalForDb.incworxDb && globalForDb.incworxDbClass !== PrismaClient) {
    const stale = globalForDb.incworxDb;
    globalForDb.incworxDb = undefined;
    void stale.$disconnect().catch(() => {});
  }
  if (!globalForDb.incworxDb) {
    globalForDb.incworxDb = createClient();
    globalForDb.incworxDbClass = PrismaClient;
  }
  return globalForDb.incworxDb;
}
