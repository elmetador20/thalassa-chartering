import { afterEach, describe, expect, it, vi } from 'vitest';

// Dev-mode hot reload after `prisma generate`: globalThis still holds a client
// built from the OLD generated code (no delegates for new models). getDb()
// must replace it instead of handing it out.

type G = { incworxDb?: unknown; incworxDbClass?: unknown };
const g = globalThis as unknown as G;

afterEach(() => {
  delete g.incworxDb;
  delete g.incworxDbClass;
  vi.unstubAllEnvs();
});

describe('getDb', () => {
  it('replaces a client cached by an older generated PrismaClient', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@127.0.0.1:1/none');
    const disconnect = vi.fn(async () => {});
    // What an HMR-surviving client from before the regeneration looks like.
    const stale = { $disconnect: disconnect, report: {} };
    g.incworxDb = stale;
    const { getDb } = await import('@/lib/server/db');

    const db = getDb();
    expect(db).not.toBe(stale);
    expect(typeof db.accessRequest.groupBy).toBe('function');
    expect(typeof db.adminInvitation.findUnique).toBe('function');
    expect(disconnect).toHaveBeenCalledOnce();
    // …and it is then reused, not recreated on every call.
    expect(getDb()).toBe(db);
  });
});
