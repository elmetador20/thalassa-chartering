import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import type { TestProject } from 'vitest/node';
import { startTestDatabase } from './test-database';

// Builds the app for production into its own directory and serves it with
// `next start` against a throwaway database, so the end-to-end tests exercise
// the real middleware, cookies, headers and Next's server-action CSRF check —
// always against the current code. The separate directory means a `next dev`
// running alongside (which writes to `.next`) can never interfere.
// Set E2E_SKIP_BUILD=1 to reuse the last e2e build.

const require = createRequire(import.meta.url);
export const E2E_DIST_DIR = '.next-e2e';
const NEXT_BIN = require.resolve('next/dist/bin/next');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

async function waitForServer(url: string, child: ChildProcess, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited early (code ${child.exitCode})`);
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('next start did not become ready in time');
}

export default async function setup(project: TestProject) {
  const buildEnv: NodeJS.ProcessEnv = { ...process.env, NEXT_DIST_DIR: E2E_DIST_DIR, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
  delete buildEnv.DATABASE_URL; // a build must never need the database

  if (process.env.E2E_SKIP_BUILD !== '1') {
    const build = spawnSync(process.execPath, [NEXT_BIN, 'build'], { env: buildEnv, stdio: 'pipe', encoding: 'utf8' });
    if (build.status !== 0) throw new Error(`next build failed:\n${(build.stdout ?? '') + (build.stderr ?? '')}`.slice(-4000));
  }
  if (!existsSync(`${E2E_DIST_DIR}/BUILD_ID`)) throw new Error(`No e2e build in ${E2E_DIST_DIR}.`);

  const database = await startTestDatabase();
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    env: { ...buildEnv, DATABASE_URL: database.url },
    stdio: 'pipe',
  });
  child.stdout?.resume();
  child.stderr?.resume();

  await waitForServer(`${baseUrl}/admin/login`, child, 90_000);
  project.provide('databaseUrl', database.url);
  project.provide('baseUrl', baseUrl);

  return async () => {
    child.kill();
    await database.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
  }
}
