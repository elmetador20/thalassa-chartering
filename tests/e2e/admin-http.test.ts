import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, inject, it } from 'vitest';
import { getDb } from '@/lib/server/db';
import { rejectAdmin, setAdminActive } from '@/lib/server/auth/admins';
import { createSession } from '@/lib/server/auth/session';
import { addAdmin, PASSWORDS, REQUEST, resetDatabase, seedSuper, SUPER } from '../support/fixtures';

// HTTP-level tests against `next start`: real middleware, real cookies, real
// headers, real server-action handling.

const BASE = inject('baseUrl');
const COOKIE = '__Host-incworx-admin'; // production cookie name
const ADMIN = { name: 'Ravi Kumar', email: 'ravi@incworx.test' };

const get = (path: string, cookie?: string) =>
  fetch(`${BASE}${path}`, { redirect: 'manual', headers: cookie ? { cookie: `${COOKIE}=${cookie}` } : {} });

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The hidden fields React renders so a form posts without JavaScript. */
async function formFields(path: string, cookie?: string): Promise<Record<string, string>> {
  const html = await (await get(path, cookie)).text();
  const fields: Record<string, string> = {};
  for (const tag of html.match(/<input[^>]*>/g) ?? []) {
    const name = /name="([^"]*)"/.exec(tag)?.[1];
    if (name && (name.startsWith('$ACTION') || name === 'next')) fields[decode(name)] = decode(/value="([^"]*)"/.exec(tag)?.[1] ?? '');
  }
  return fields;
}

/** Submits the sign-in form exactly as a browser with JS disabled would. */
async function submitLogin(email: string, password: string, origin = BASE) {
  const body = new FormData();
  for (const [k, v] of Object.entries(await formFields('/admin/login'))) body.append(k, v);
  body.append('email', email);
  body.append('password', password);
  return fetch(`${BASE}/admin/login`, { method: 'POST', body, redirect: 'manual', headers: { origin } });
}

function sessionCookie(res: Response): string | null {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE}=`));
  return header ?? null;
}

const tokenFrom = (setCookie: string) => setCookie.split(';')[0].slice(COOKIE.length + 1);

async function sessionFor(adminId: string) {
  return (await createSession(getDb(), adminId, REQUEST)).token;
}

beforeEach(resetDatabase);

describe('protected routes', () => {
  it.each(['/admin', '/admin/reports', '/admin/users', '/admin/account', '/admin/reports/new', '/admin/reports/123/edit'])(
    'unauthenticated %s → /admin/login',
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(307);
      const location = new URL(res.headers.get('location')!, BASE);
      expect(location.pathname).toBe('/admin/login');
      expect(location.searchParams.get('next')).toBe(path);
    },
  );

  it('a forged cookie gets past the middleware but not the server', async () => {
    const res = await get('/admin/users', 'A'.repeat(43));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!, BASE).pathname).toBe('/admin/login');
  });

  it('an ADMIN gets 404 for /admin/users but can use the reports area', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN, { approve: true });
    const token = await sessionFor(id);

    const denied = await get('/admin/users', token);
    expect(denied.status).toBe(404);
    const deniedTitle = /<title>([^<]*)<\/title>/.exec(await denied.text())?.[1] ?? '';
    expect(deniedTitle).not.toContain('Administrators'); // the 404 doesn't name the page
    expect((await get('/admin/reports', token)).status).toBe(200);
    const dashboard = await (await get('/admin', token)).text();
    expect(dashboard).not.toContain('href="/admin/users"'); // nav link hidden for this role
  });

  it('a SUPER_ADMIN can open /admin/users', async () => {
    const superCtx = await seedSuper();
    const res = await get('/admin/users', await sessionFor(superCtx.admin.id));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Add an administrator');
  });

  it('a signed-in visitor to /admin/login goes to /admin/reports', async () => {
    const superCtx = await seedSuper();
    const res = await get('/admin/login', await sessionFor(superCtx.admin.id));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!, BASE).pathname).toBe('/admin/reports');
  });

  it('deactivation takes effect on the very next request', async () => {
    const superCtx = await seedSuper();
    const id = await addAdmin(superCtx, ADMIN, { approve: true });
    const token = await sessionFor(id);
    expect((await get('/admin', token)).status).toBe(200);
    await setAdminActive(superCtx, { adminId: id, active: false }, REQUEST);
    expect((await get('/admin', token)).status).toBe(307);
  });
});

describe('sign-in over HTTP (no JavaScript)', () => {
  it('signs the Super Admin in and sets a hardened cookie', async () => {
    await seedSuper();
    const res = await submitLogin(SUPER.email, PASSWORDS.superAdmin);
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!, BASE).pathname).toBe('/admin');

    const cookie = sessionCookie(res);
    expect(cookie).not.toBeNull();
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/;\s*SameSite=Strict/i);
    expect(cookie).toMatch(/;\s*Path=\//i);
    expect(cookie).not.toMatch(/Domain=/i);

    const expires = new Date(/Expires=([^;]+)/i.exec(cookie!)![1]).getTime();
    expect(expires - Date.now()).toBeGreaterThan(11.9 * 3600_000);
    expect(expires - Date.now()).toBeLessThanOrEqual(12 * 3600_000 + 5000);

    // The cookie really is a working session.
    expect((await get('/admin', tokenFrom(cookie!))).status).toBe(200);
  });

  it('wrong password: generic message, no cookie', async () => {
    await seedSuper();
    const res = await submitLogin(SUPER.email, 'Wrong-Password-99!');
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toBeNull();
    expect(await res.text()).toContain('Invalid email or password.');
  });

  it('pending, rejected and inactive accounts get their specific messages, and no cookie', async () => {
    const superCtx = await seedSuper();
    await addAdmin(superCtx, ADMIN);
    const rejectedId = await addAdmin(superCtx, { name: 'Anita Desai', email: 'anita@incworx.test' });
    const inactiveId = await addAdmin(superCtx, { name: 'Kiran Rao', email: 'kiran@incworx.test' }, { approve: true });
    await rejectAdmin(superCtx, { adminId: rejectedId }, REQUEST);
    await setAdminActive(superCtx, { adminId: inactiveId, active: false }, REQUEST);

    const cases = [
      [ADMIN.email, 'Your account is awaiting Super Admin approval.'],
      ['anita@incworx.test', 'Your account access has been rejected. Contact the Super Admin.'],
      ['kiran@incworx.test', 'Your account is inactive. Contact the Super Admin.'],
    ] as const;
    for (const [email, message] of cases) {
      const res = await submitLogin(email, PASSWORDS.admin);
      expect(sessionCookie(res), email).toBeNull();
      expect(await res.text(), email).toContain(message);
    }
  });

  it('a cross-site POST of the login form is refused (CSRF)', async () => {
    await seedSuper();
    const before = await getDb().auditLog.count({ where: { action: 'LOGIN_SUCCEEDED' } });
    const res = await submitLogin(SUPER.email, PASSWORDS.superAdmin, 'https://evil.example');
    expect(res.status).not.toBe(303);
    expect(sessionCookie(res)).toBeNull();
    expect(await getDb().auditLog.count({ where: { action: 'LOGIN_SUCCEEDED' } })).toBe(before);
  });

  it('sign-out ends the session server-side and clears the cookie', async () => {
    await seedSuper();
    const login = await submitLogin(SUPER.email, PASSWORDS.superAdmin);
    const token = tokenFrom(sessionCookie(login)!);

    const body = new FormData();
    for (const [k, v] of Object.entries(await formFields('/admin', token))) body.append(k, v);
    const res = await fetch(`${BASE}/admin`, { method: 'POST', body, redirect: 'manual', headers: { origin: BASE, cookie: `${COOKIE}=${token}` } });
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get('location')!, BASE).pathname).toBe('/admin/login');
    expect(sessionCookie(res)).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);

    // The old token is dead even if a copy survived somewhere.
    expect((await get('/admin', token)).status).toBe(307);
  });
});

describe('response hardening', () => {
  it('admin pages are never indexed or framed', async () => {
    const res = await get('/admin/login');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(await res.text()).toMatch(/<meta name="robots" content="noindex, nofollow/);
  });

  it('no secret reaches a page', async () => {
    const superCtx = await seedSuper();
    await addAdmin(superCtx, ADMIN, { approve: true });
    const token = await sessionFor(superCtx.admin.id);
    for (const path of ['/admin', '/admin/users', '/admin/account', '/admin/reports']) {
      const html = await (await get(path, token)).text();
      expect(html).not.toContain('$argon2');
      expect(html).not.toMatch(/passwordHash|password_hash/);
      expect(html).not.toContain('postgres:postgres');
      expect(html).not.toContain(token); // the session token is HttpOnly-only
    }
  });

  it('no server secret or server-only code is bundled for the browser', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith('.js')) files.push(full);
      }
    };
    walk('.next-e2e/static');
    const bundle = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const forbidden of ['DATABASE_URL', 'DIRECT_URL', 'R2_SECRET_ACCESS_KEY', 'SUPER_ADMIN_PASSWORD', '$argon2', 'pg_advisory']) {
      expect(bundle, forbidden).not.toContain(forbidden);
    }
    // The ~800 KB password dictionaries stay on the server.
    expect(bundle).not.toContain('passwords-common');
  });
});
