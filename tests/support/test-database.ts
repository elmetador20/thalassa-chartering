import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

// ============================================================================
// A real, throwaway PostgreSQL for tests — started fresh, deleted afterwards.
//
// Shaped like the production Supabase database: the API roles exist (so the
// migration's access-hardening runs for real) and there is pre-existing data
// in `public` (so the migrations prove they leave it alone). Migrations are
// applied by the real `prisma migrate deploy`, exactly as in production.
// ============================================================================

const require = createRequire(import.meta.url);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

export interface TestDatabase {
  url: string;
  stop(): Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const dir = mkdtempSync(join(tmpdir(), 'incworx-test-pg-'));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('incworx_test');
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/incworx_test`;

  const client = pg.getPgClient('incworx_test', '127.0.0.1');
  await client.connect();
  await client.query(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE TABLE public.legacy_customers (id serial PRIMARY KEY, name text NOT NULL);
    INSERT INTO public.legacy_customers (name) VALUES ('kept-1'), ('kept-2'), ('kept-3');
  `);
  await client.end();

  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    env: { ...process.env, DIRECT_URL: url, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: 'pipe',
  });

  return {
    url,
    async stop() {
      await pg.stop();
      // On Windows Postgres can hold file locks for a moment after stopping;
      // retry rather than leave the folder behind in the temp directory.
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    },
  };
}
