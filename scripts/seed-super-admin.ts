/**
 * Creates the single initial SUPER_ADMIN. Idempotent: does nothing if one
 * already exists, and never changes an existing account.
 *
 *   npm run db:seed
 *
 * Credentials come from SUPER_ADMIN_NAME / SUPER_ADMIN_EMAIL /
 * SUPER_ADMIN_PASSWORD, or — preferably, for the password — are asked for
 * interactively, with the password hidden as you type. A password typed at the
 * prompt never touches a file or your shell history.
 *
 * Nothing here prints a password, hash or connection string.
 */
import { loadEnvConfig } from '@next/env';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { describeErrorSafely } from '../src/lib/server/safe-error';

loadEnvConfig(process.cwd());

/** Values typed or read during this run that error output must never echo. */
const runSecrets: string[] = [];

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Reads a line without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY) {
      reject(new Error('A hidden prompt needs an interactive terminal.'));
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';

    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish();
        if (ch === '\u0003') return finish(new Error('Cancelled.'));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env first (see .env.example).');
    return 1;
  }

  // Imported after the env is loaded: the database client reads it lazily.
  const { seedSuperAdmin } = await import('../src/lib/server/auth/seed');
  const { getDb } = await import('../src/lib/server/db');

  try {
    // Preflight, read-only: fail fast — before anyone types a password — if the
    // database is unreachable or not migrated (the error names the cause), and
    // skip the prompts entirely when a Super Admin already exists.
    if (await getDb().adminUser.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })) {
      console.log('A Super Admin already exists. Nothing was changed.');
      return 0;
    }

    const interactive = Boolean(stdin.isTTY);
    const name = process.env.SUPER_ADMIN_NAME?.trim() || (interactive ? await ask('Super Admin name: ') : '');
    const email = process.env.SUPER_ADMIN_EMAIL?.trim() || (interactive ? await ask('Super Admin email: ') : '');

    let password = process.env.SUPER_ADMIN_PASSWORD ?? '';
    const fromEnv = Boolean(password);
    if (!password) {
      if (!interactive) {
        console.error('Set SUPER_ADMIN_PASSWORD, or run this in an interactive terminal to be prompted.');
        return 1;
      }
      password = await askHidden('Password (hidden): ');
      const confirm = await askHidden('Confirm password: ');
      if (password !== confirm) {
        console.error('Passwords do not match. Nothing was created.');
        return 1;
      }
    }
    runSecrets.push(password);

    const result = await seedSuperAdmin({ name, email, password });

    switch (result.status) {
      case 'created':
        console.log(`Super Admin created for ${maskEmail(email.toLowerCase())}. Sign in at /admin/login.`);
        if (fromEnv) {
          console.log('If SUPER_ADMIN_PASSWORD is stored in an env file, delete that line now.');
        }
        return 0;
      case 'exists':
        console.log('A Super Admin already exists. Nothing was changed.');
        return 0;
      case 'email_taken':
        console.error('That email already belongs to an administrator, who will not be promoted. Use another email.');
        return 1;
      case 'invalid':
        console.error('The details did not pass validation:');
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          for (const message of messages ?? []) console.error(`  ${field === 'password' ? 'password' : field}: ${message}`);
        }
        return 1;
    }
  } finally {
    await getDb().$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    // Never dump the raw error object: it can carry connection details. The
    // safe description keeps the type, Prisma code, actual reason and a hint,
    // and redacts connection strings, passwords (including the one typed
    // above), hashes and tokens. The transaction rolls back on any failure,
    // so a failed run never leaves a partial account behind.
    console.error(`Seed failed: ${describeErrorSafely(error, runSecrets)}`);
    console.error('Nothing was created.');
    process.exit(1);
  });
