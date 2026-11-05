import { beforeEach, describe, expect, inject, it } from 'vitest';
import { getDb } from '@/lib/server/db';
import { createSession } from '@/lib/server/auth/session';
import { archiveReport, createReport, requestReportUpload } from '@/lib/server/reports/service';
import type { AuthContext } from '@/lib/server/auth/session';
import { addAdmin, contextFor, REQUEST, resetDatabase, seedSuper } from '../support/fixtures';
import { fakePdf, MemoryStorage } from '../support/memory-storage';

// HTTP-level tests for the reports system against `next start`. The server
// runs exactly as production does today: with NO storage credentials, so
// every file operation must answer "storage unavailable" cleanly while the
// rest of the system works. Reports are created in this process through the
// real service (with in-memory storage) into the same throwaway database.

const BASE = inject('baseUrl');
const COOKIE = '__Host-incworx-admin';

const get = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  fetch(`${BASE}${path}`, { redirect: 'manual', headers: { ...headers, ...(cookie ? { cookie: `${COOKIE}=${cookie}` } : {}) } });

const postUpload = (body: unknown, opts: { cookie?: string; origin?: string | null; contentType?: string } = {}) => {
  const headers: Record<string, string> = { 'content-type': opts.contentType ?? 'application/json' };
  if (opts.origin !== null) headers.origin = opts.origin ?? BASE;
  if (opts.cookie) headers.cookie = `${COOKIE}=${opts.cookie}`;
  return fetch(`${BASE}/api/admin/report-uploads`, {
    method: 'POST',
    redirect: 'manual',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
};

const VALID_UPLOAD = { fileName: 'weekly.pdf', contentType: 'application/pdf', size: 2048 };

let superCtx: AuthContext;
let adminCtx: AuthContext;
let superToken: string;
let adminToken: string;
const storage = new MemoryStorage();

async function makeReport(title: string, intent: 'draft' | 'publish', extra: Record<string, unknown> = {}) {
  const issued = await requestReportUpload(adminCtx, { fileName: 'r.pdf', contentType: 'application/pdf', size: 2048 }, { storage });
  await storage.simulateBrowserUpload(issued.url, fakePdf());
  return createReport(
    adminCtx,
    { title, category: 'GLOBAL', reportDate: '2026-11-02', description: 'TEST report.', ...extra, uploadKey: issued.uploadKey, fileName: 'r.pdf', intent },
    { storage },
  );
}

beforeEach(async () => {
  await resetDatabase();
  superCtx = await seedSuper();
  adminCtx = await contextFor(await addAdmin(superCtx, { name: 'Ravi Kumar', email: 'ravi@incworx.test' }, { approve: true }));
  superToken = (await createSession(getDb(), superCtx.admin.id, REQUEST)).token;
  adminToken = (await createSession(getDb(), adminCtx.admin.id, REQUEST)).token;
});

// ---------------------------------------------------------- upload endpoint --

describe('POST /api/admin/report-uploads', () => {
  it('401 without a session', async () => {
    const res = await postUpload(VALID_UPLOAD);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('unauthenticated');
  });

  it('403 for a cross-site origin, even with a valid session', async () => {
    const res = await postUpload(VALID_UPLOAD, { cookie: adminToken, origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('forbidden_origin');
  });

  it('403 when the request carries no origin information at all', async () => {
    expect((await postUpload(VALID_UPLOAD, { cookie: adminToken, origin: null })).status).toBe(403);
  });

  it('400 for a body that is not JSON', async () => {
    expect((await postUpload('not json', { cookie: adminToken })).status).toBe(400);
    expect((await postUpload(VALID_UPLOAD, { cookie: adminToken, contentType: 'text/plain' })).status).toBe(400);
  });

  it('400 with field errors for a file that is not an acceptable PDF', async () => {
    for (const body of [
      { ...VALID_UPLOAD, contentType: 'text/html' },
      { ...VALID_UPLOAD, fileName: 'report.exe' },
      { ...VALID_UPLOAD, size: 50 * 1024 * 1024 + 1 },
    ]) {
      const res = await postUpload(body, { cookie: adminToken });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('validation');
      expect(Object.keys(json.error.fieldErrors ?? {})).not.toHaveLength(0);
    }
  });

  it('503 — clearly and safely — while storage is not configured', async () => {
    const res = await postUpload(VALID_UPLOAD, { cookie: adminToken });
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(res.headers.get('x-robots-tag')).toMatch(/noindex/);
    const json = await res.json();
    expect(json.error.code).toBe('storage_unavailable');
    expect(JSON.stringify(json)).not.toMatch(/R2_|secret|access.?key/i);
  });

  it('only POST is accepted', async () => {
    expect((await get('/api/admin/report-uploads', adminToken)).status).toBe(405);
  });
});

// -------------------------------------------------------------- file links --

describe('file endpoints', () => {
  it('public: a published report answers 503 (no storage), drafts/archived/unknown are 404', async () => {
    const published = await makeReport('TEST Published', 'publish');
    const draft = await makeReport('TEST Draft', 'draft');
    const archived = await makeReport('TEST Archived', 'publish');
    await archiveReport(adminCtx, archived.id);

    const ok = await get(`/api/reports/${published.slug}/file?format=json`);
    expect(ok.status).toBe(503);
    expect(ok.headers.get('cache-control')).toMatch(/no-store/);
    for (const slug of [draft.slug, archived.slug, 'no-such-report', 'UPPER-case', '..%2F..%2Fetc']) {
      const res = await get(`/api/reports/${slug}/file`);
      expect(res.status, slug).toBe(404);
    }
  });

  it('a person following a file link sees a readable page, never raw JSON', async () => {
    const published = await makeReport('TEST Published', 'publish');
    const draft = await makeReport('TEST Draft', 'draft');
    const unavailable = await get(`/api/reports/${published.slug}/file`);
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('content-type')).toMatch(/text\/html/);
    expect(await unavailable.text()).toContain('PDF temporarily unavailable');
    const missing = await get(`/api/reports/${draft.slug}/file?disposition=inline`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('Report not found');
  });

  it('admin: 401 (JSON) or sign-in redirect without a session, 404 for an unknown id, 503 for a real one', async () => {
    const draft = await makeReport('TEST Draft', 'draft');
    expect((await get(`/api/admin/reports/${draft.id}/file?format=json`)).status).toBe(401);
    const redirect = await get(`/api/admin/reports/${draft.id}/file`);
    expect(redirect.status).toBe(303);
    expect(new URL(redirect.headers.get('location')!).pathname).toBe('/admin/login');
    expect((await get('/api/admin/reports/00000000-0000-4000-8000-000000000000/file', adminToken)).status).toBe(404);
    expect((await get('/api/admin/reports/not-a-uuid/file', adminToken)).status).toBe(404);
    expect((await get(`/api/admin/reports/${draft.id}/file?disposition=inline&format=json`, adminToken)).status).toBe(503);
  });
});

// ------------------------------------------------------------- public pages --

describe('public report pages', () => {
  it('/reports lists published reports only', async () => {
    await makeReport('TEST Published global', 'publish');
    await makeReport('TEST Hidden draft', 'draft');
    const archived = await makeReport('TEST Withdrawn', 'publish');
    await archiveReport(adminCtx, archived.id);

    const res = await get('/reports');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('TEST Published global');
    expect(html).not.toContain('TEST Hidden draft');
    expect(html).not.toContain('TEST Withdrawn');
    expect(html).not.toMatch(/noindex/);
  });

  it('filters through the URL: category, search, exact date, month', async () => {
    await makeReport('TEST Iron ore weekly', 'publish');
    await makeReport('TEST Coal domestic', 'publish', { category: 'DOMESTIC', reportDate: '2026-10-15' });

    const text = async (path: string) => (await get(path)).text();
    expect(await text('/reports?category=domestic')).toContain('TEST Coal domestic');
    expect(await text('/reports?category=domestic')).not.toContain('TEST Iron ore weekly');
    expect(await text('/reports?q=iron')).not.toContain('TEST Coal domestic');
    expect(await text('/reports?date=2026-10-15')).toContain('TEST Coal domestic');
    expect(await text('/reports?year=2026&month=11')).not.toContain('TEST Coal domestic');
    // A narrowed view is not indexed, but its links are followed.
    expect(await text('/reports?q=iron')).toMatch(/<meta name="robots" content="noindex, follow"/);
    // Nonsense parameters are ignored, never an error.
    expect((await get('/reports?page=-4&date=2026-02-31&category=%3Cscript%3E&sort=x')).status).toBe(200);
  });

  it('/reports/[slug]: published shows; draft, archived and unknown are a plain 404', async () => {
    const published = await makeReport('TEST Published detail', 'publish');
    const draft = await makeReport('TEST Draft detail', 'draft');
    const archived = await makeReport('TEST Archived detail', 'publish');
    await archiveReport(adminCtx, archived.id);

    const ok = await get(`/reports/${published.slug}`);
    expect(ok.status).toBe(200);
    const html = await ok.text();
    expect(html).toContain('TEST Published detail');
    expect(html).toContain(`/api/reports/${published.slug}/file`);
    expect(html).toContain(`<link rel="canonical" href="https://incworx.in/reports/${published.slug}"`);

    for (const slug of [draft.slug, archived.slug, 'missing-report-2026-11-02-abcdef']) {
      const res = await get(`/reports/${slug}`);
      expect(res.status, slug).toBe(404);
      const body = await res.text();
      expect(body).not.toContain('TEST Draft detail');
      expect(body).not.toContain('TEST Archived detail');
    }
  });

  it('the report pages link back to the homepage sections, and Reports is in the navigation', async () => {
    const html = await (await get('/reports')).text();
    expect(html).toContain('href="/#about"');
    expect(html).toContain('href="/#contact"');
    expect(html).toContain('href="/reports"');
    expect(html).not.toContain('href="#about"');
  });
});

// ---------------------------------------------------------------- homepage --

describe('homepage', () => {
  it('keeps its in-page anchors, links to Reports, and has no reports section', async () => {
    await makeReport('TEST Should not be on the homepage', 'publish');
    const html = await (await get('/')).text();
    expect(html).toContain('href="#about"');
    expect(html).toContain('href="/reports"');
    expect(html).not.toContain('TEST Should not be on the homepage');
    expect(html).not.toMatch(/latest reports/i);
  });
});

// ------------------------------------------------------------- admin pages --

describe('admin report pages', () => {
  it('the list shows every status to an ADMIN, with filters', async () => {
    await makeReport('TEST Admin published', 'publish');
    await makeReport('TEST Admin draft', 'draft');
    const all = await (await get('/admin/reports', adminToken)).text();
    expect(all).toContain('TEST Admin published');
    expect(all).toContain('TEST Admin draft');
    const drafts = await (await get('/admin/reports?status=draft', adminToken)).text();
    expect(drafts).not.toContain('TEST Admin published');
    expect(drafts).toContain('TEST Admin draft');
  });

  it('the upload page explains that storage is not connected yet', async () => {
    const res = await get('/admin/reports/new', adminToken);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('PDF storage is not connected yet');
  });

  it('the edit page: delete controls for the Super Admin only; unknown ids are 404', async () => {
    const r = await makeReport('TEST Editable', 'draft');
    const asAdmin = await (await get(`/admin/reports/${r.id}/edit`, adminToken)).text();
    expect(asAdmin).toContain('TEST Editable');
    expect(asAdmin).not.toContain('Delete permanently');
    const asSuper = await (await get(`/admin/reports/${r.id}/edit`, superToken)).text();
    expect(asSuper).toContain('Delete permanently');
    expect((await get('/admin/reports/00000000-0000-4000-8000-000000000000/edit', adminToken)).status).toBe(404);
    expect((await get('/admin/reports/nope/edit', adminToken)).status).toBe(404);
  });

  it('report pages and endpoints never leak the storage key', async () => {
    const r = await makeReport('TEST Key check', 'publish');
    const { fileKey } = await getDb().report.findUniqueOrThrow({ where: { id: r.id } });
    for (const path of ['/reports', `/reports/${r.slug}`, '/admin/reports', `/admin/reports/${r.id}/edit`]) {
      const html = await (await get(path, adminToken)).text();
      expect(html, path).not.toContain(fileKey);
    }
  });
});

// ------------------------------------------------------------ crawler files --

describe('sitemap and robots', () => {
  it('the sitemap lists published reports only', async () => {
    const published = await makeReport('TEST Sitemap published', 'publish');
    const draft = await makeReport('TEST Sitemap draft', 'draft');
    const xml = await (await get('/sitemap.xml')).text();
    expect(xml).toContain('https://incworx.in/reports</loc>');
    expect(xml).toContain(`/reports/${published.slug}</loc>`);
    expect(xml).not.toContain(draft.slug);
  });

  it('robots.txt keeps crawlers out of the admin area and the API', async () => {
    const txt = await (await get('/robots.txt')).text();
    expect(txt).toMatch(/Disallow: \/admin/);
    expect(txt).toMatch(/Disallow: \/api\//);
    expect(txt).toContain('Sitemap: https://incworx.in/sitemap.xml');
  });
});
