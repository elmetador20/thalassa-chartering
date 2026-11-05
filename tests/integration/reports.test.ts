import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/server/db';
import { ForbiddenError } from '@/lib/server/auth/errors';
import { listRecentActivity } from '@/lib/server/audit';
import { ReportError } from '@/lib/server/reports/errors';
import { getPublishedReportBySlug, listPublishedReports, listReports } from '@/lib/server/reports/queries';
import {
  archiveReport,
  createAdminFileUrl,
  createPublicFileUrl,
  createReport,
  deleteReport,
  publishReport,
  replaceReportFile,
  requestReportUpload,
  restoreReport,
  updateReport,
} from '@/lib/server/reports/service';
import { getStorage } from '@/lib/server/storage';
import { dateBounds, resolveDateFilter } from '@/lib/reports/filters';
import { MAX_PDF_BYTES } from '@/lib/reports/constants';
import type { AuthContext } from '@/lib/server/auth/session';
import { addAdmin, contextFor, REQUEST, resetDatabase, seedSuper } from '../support/fixtures';
import { fakePdf, MemoryStorage, notAPdf } from '../support/memory-storage';

const db = () => getDb();
let storage: MemoryStorage;
let superCtx: AuthContext;
let adminCtx: AuthContext;

const details = (o: Record<string, unknown> = {}) => ({
  title: 'TEST Iron ore weekly outlook',
  category: 'GLOBAL',
  reportDate: '2026-11-05',
  description: 'TEST report — created by the automated test suite.',
  ...o,
});

async function upload(ctx: AuthContext, bytes: Uint8Array = fakePdf(), fileName = 'weekly-report.pdf') {
  const issued = await requestReportUpload(ctx, { fileName, contentType: 'application/pdf', size: bytes.length }, { storage });
  await storage.simulateBrowserUpload(issued.url, bytes);
  return { uploadKey: issued.uploadKey, fileName };
}

async function create(ctx: AuthContext, overrides: Record<string, unknown> = {}, intent: 'draft' | 'publish' = 'draft') {
  return createReport(ctx, { ...details(overrides), ...(await upload(ctx)), intent }, { storage, request: REQUEST });
}

const auditActions = async (reportId: string) =>
  (await db().auditLog.findMany({ where: { targetType: 'report', targetId: reportId }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);

beforeAll(async () => {
  // Test-only trigger: makes the database reject chosen writes, to exercise
  // the clean-up paths with a real database failure.
  await db().$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION incworx.test_fail_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.title LIKE 'FAIL-INSERT%' OR NEW.file_name LIKE 'fail-update%' THEN
        RAISE EXCEPTION 'simulated database failure';
      END IF;
      RETURN NEW;
    END $$`);
  await db().$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_write ON incworx.reports`);
  await db().$executeRawUnsafe(`CREATE TRIGGER test_fail_write BEFORE INSERT OR UPDATE ON incworx.reports FOR EACH ROW EXECUTE FUNCTION incworx.test_fail_write()`);
});

afterAll(async () => {
  await db().$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_write ON incworx.reports`);
  await db().$executeRawUnsafe(`DROP FUNCTION IF EXISTS incworx.test_fail_write()`);
});

beforeEach(async () => {
  await resetDatabase();
  storage = new MemoryStorage();
  superCtx = await seedSuper();
  adminCtx = await contextFor(await addAdmin(superCtx, { name: 'Ravi Kumar', email: 'ravi@incworx.test' }, { approve: true }));
  vi.restoreAllMocks();
});

// --------------------------------------------------------------- lifecycle --

describe('creating reports', () => {
  it('saves a draft: file verified, copied to reports/, pending removed, audited', async () => {
    const r = await create(adminCtx);
    expect(r).toMatchObject({ status: 'DRAFT', duplicate: false, warnings: [] });
    const row = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    expect(row).toMatchObject({ status: 'DRAFT', publishedAt: null, archivedAt: null, mimeType: 'application/pdf', fileName: 'weekly-report.pdf', fileSize: 2048 });
    expect(row.fileKey).toMatch(/^reports\/[0-9a-f-]{36}\.pdf$/);
    expect(storage.keys()).toEqual([row.fileKey]); // nothing left under pending/
    expect(await auditActions(r.id)).toEqual(['REPORT_UPLOADED']);
  });

  it('publishes on creation: publishedAt set, uploaded + published audited', async () => {
    const r = await create(adminCtx, {}, 'publish');
    const row = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.status).toBe('PUBLISHED');
    expect(row.publishedAt).toBeInstanceOf(Date);
    expect(await auditActions(r.id)).toEqual(['REPORT_UPLOADED', 'REPORT_PUBLISHED']);
  });

  it('keeps the report date independent of the upload date (historical back-fill)', async () => {
    const r = await create(adminCtx, { reportDate: '2003-07-15' });
    const row = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.reportDate.toISOString().slice(0, 10)).toBe('2003-07-15');
    expect(row.createdAt.getUTCFullYear()).toBeGreaterThan(2003);
  });

  it.each([
    ['1999-12-31', 'Report dates start on 1 January 2000.'],
    ['2999-01-01', 'The report date cannot be in the future.'],
    ['2026-02-30', 'Enter a valid date.'],
  ])('rejects report date %s', async (reportDate, message) => {
    const u = await upload(adminCtx);
    await expect(createReport(adminCtx, { ...details({ reportDate }), ...u, intent: 'draft' }, { storage })).rejects.toMatchObject({
      code: 'validation',
      fieldErrors: { reportDate: [message] },
    });
  });

  it('allows several reports with the same title, category and date — each with its own slug', async () => {
    const a = await create(adminCtx, {}, 'publish');
    const b = await create(adminCtx, {}, 'publish');
    const c = await create(adminCtx, { title: 'TEST Coal freight' }, 'publish');
    expect(new Set([a.slug, b.slug, c.slug]).size).toBe(3);
    const sameDay = await listPublishedReports({ category: 'GLOBAL', from: '2026-11-05', to: '2026-11-05' });
    expect(sameDay.total).toBe(3);
  });

  it('a double submit of the same upload creates ONE report', async () => {
    const u = await upload(adminCtx);
    const input = { ...details(), ...u, intent: 'draft' };
    const [one, two] = await Promise.all([createReport(adminCtx, input, { storage }), createReport(adminCtx, input, { storage })]);
    expect(one.id).toBe(two.id);
    expect([one.duplicate, two.duplicate].sort()).toEqual([false, true]);
    const again = await createReport(adminCtx, input, { storage });
    expect(again).toMatchObject({ id: one.id, duplicate: true });
    expect(await db().report.count()).toBe(1);
  });
});

describe('status lifecycle', () => {
  it('Draft → Published sets the first-publication date', async () => {
    const r = await create(adminCtx);
    await publishReport(adminCtx, r.id, { storage });
    const row = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    expect(row).toMatchObject({ status: 'PUBLISHED' });
    expect(row.publishedAt).toBeInstanceOf(Date);
  });

  it('archive → restore → publish keeps the ORIGINAL publication date', async () => {
    const first = new Date('2026-11-01T09:00:00Z');
    const r = await create(adminCtx);
    await publishReport(adminCtx, r.id, { now: first });
    await archiveReport(adminCtx, r.id, { now: new Date('2026-11-02T09:00:00Z') });
    let row = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.status).toBe('ARCHIVED');
    expect(row.archivedAt?.toISOString()).toBe('2026-11-02T09:00:00.000Z');

    await restoreReport(adminCtx, r.id);
    row = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    expect(row).toMatchObject({ status: 'DRAFT', archivedAt: null });
    expect(row.publishedAt?.toISOString()).toBe(first.toISOString());

    await publishReport(adminCtx, r.id, { now: new Date('2026-11-04T09:00:00Z') });
    row = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.publishedAt?.toISOString()).toBe(first.toISOString());
    expect(await auditActions(r.id)).toEqual(['REPORT_UPLOADED', 'REPORT_PUBLISHED', 'REPORT_ARCHIVED', 'REPORT_RESTORED', 'REPORT_PUBLISHED']);
  });

  it('a draft can be archived directly', async () => {
    const r = await create(adminCtx);
    await archiveReport(adminCtx, r.id);
    expect((await db().report.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('ARCHIVED');
  });

  it('refuses impossible transitions with a clear reason', async () => {
    const r = await create(adminCtx, {}, 'publish');
    await expect(publishReport(adminCtx, r.id)).rejects.toMatchObject({ code: 'invalid_transition', message: 'This report is already published.' });
    await expect(restoreReport(adminCtx, r.id)).rejects.toMatchObject({ code: 'invalid_transition' });
    await archiveReport(adminCtx, r.id);
    await expect(archiveReport(adminCtx, r.id)).rejects.toMatchObject({ message: 'This report is already archived.' });
    await expect(publishReport(adminCtx, r.id)).rejects.toMatchObject({ message: 'Restore this report before publishing it.' });
  });

  it('two simultaneous status changes: exactly one wins', async () => {
    const r = await create(adminCtx);
    const results = await Promise.allSettled([publishReport(adminCtx, r.id), publishReport(superCtx, r.id)]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((await auditActions(r.id)).filter((a) => a === 'REPORT_PUBLISHED')).toHaveLength(1);
  });

  it('editing details never changes the status, and records what changed', async () => {
    const r = await create(adminCtx, {}, 'publish');
    const out = await updateReport(adminCtx, r.id, details({ title: 'TEST Renamed', category: 'SPECIAL' }));
    expect(out.changed).toEqual(['title', 'category']);
    const row = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    expect(row).toMatchObject({ title: 'TEST Renamed', category: 'SPECIAL', status: 'PUBLISHED', slug: r.slug });
    const unchanged = await updateReport(adminCtx, r.id, details({ title: 'TEST Renamed', category: 'SPECIAL' }));
    expect(unchanged.changed).toEqual([]);
    expect((await auditActions(r.id)).filter((a) => a === 'REPORT_UPDATED')).toHaveLength(1);
  });
});

describe('permanent deletion', () => {
  it('is refused to an ADMIN', async () => {
    const r = await create(adminCtx);
    await expect(deleteReport(adminCtx, r.id, 'TEST Iron ore weekly outlook', { storage })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db().report.count()).toBe(1);
  });

  it('requires the exact title as confirmation, checked on the server', async () => {
    const r = await create(adminCtx);
    for (const wrong of ['', 'TEST Iron ore', 'test iron ore weekly outlook', undefined]) {
      await expect(deleteReport(superCtx, r.id, wrong, { storage })).rejects.toMatchObject({ code: 'confirmation' });
    }
    expect(await db().report.count()).toBe(1);
  });

  it('Super Admin with confirmation: row, file and nothing else gone; audit keeps the record', async () => {
    const r = await create(adminCtx);
    const { fileKey } = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    const out = await deleteReport(superCtx, r.id, '  TEST Iron ore weekly outlook  ', { storage });
    expect(out.warnings).toEqual([]);
    expect(await db().report.count()).toBe(0);
    expect(storage.keys()).toEqual([]);
    const audit = await db().auditLog.findFirstOrThrow({ where: { action: 'REPORT_DELETED' } });
    expect(audit.metadata).toMatchObject({ title: 'TEST Iron ore weekly outlook', fileKey });
    // The deleted report still has a readable history.
    const history = await listRecentActivity({ target: { type: 'report', id: r.id }, limit: 10 });
    expect(history[0].target?.label).toBe('TEST Iron ore weekly outlook');
  });

  it('is refused while storage is not configured, so no file is orphaned', async () => {
    const r = await create(adminCtx);
    await expect(deleteReport(superCtx, r.id, 'TEST Iron ore weekly outlook')).rejects.toMatchObject({ code: 'storage_unavailable' });
    expect(await db().report.count()).toBe(1);
  });

  it('if the file cannot be removed, the report is still deleted and the admin is told', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await create(adminCtx);
    storage.failOn('delete', { keyPrefix: 'reports/' });
    const out = await deleteReport(superCtx, r.id, 'TEST Iron ore weekly outlook', { storage });
    expect(await db().report.count()).toBe(0);
    expect(out.warnings[0]).toMatch(/could not be removed from storage/);
    expect(storage.keys('reports/')).toHaveLength(1); // left for reconciliation, key is in the audit log
  });
});

// ---------------------------------------------------------- upload security --

describe('upload security', () => {
  it.each([
    [{ contentType: 'text/html' }, 'contentType'],
    [{ fileName: 'report.exe' }, 'fileName'],
    [{ fileName: '../reports/x.pdf' }, 'fileName'],
    [{ size: MAX_PDF_BYTES + 1 }, 'size'],
    [{ size: 0 }, 'size'],
  ])('refuses to issue an upload URL for %o', async (override, field) => {
    const request = { fileName: 'r.pdf', contentType: 'application/pdf', size: 1000, ...override };
    await expect(requestReportUpload(adminCtx, request, { storage })).rejects.toMatchObject({ code: 'validation', fieldErrors: { [field]: expect.any(Array) } });
    expect(storage.calls.filter((c) => c.op === 'createUploadUrl')).toHaveLength(0);
  });

  it('rejects a file whose bytes are not a PDF, and deletes it', async () => {
    for (const kind of ['html', 'zip'] as const) {
      const u = await upload(adminCtx, notAPdf(kind));
      await expect(createReport(adminCtx, { ...details(), ...u, intent: 'draft' }, { storage })).rejects.toMatchObject({
        code: 'upload_invalid',
        message: 'This file is not a valid PDF.',
      });
    }
    expect(await db().report.count()).toBe(0);
    expect(storage.keys()).toEqual([]);
  });

  it('rejects an object over 50 MB or stored with the wrong type, even if it got into the bucket', async () => {
    const key1 = `pending/${adminCtx.admin.id}/00000000-0000-4000-8000-000000000001.pdf`;
    storage.put(key1, fakePdf(MAX_PDF_BYTES + 1));
    await expect(createReport(adminCtx, { ...details(), uploadKey: key1, fileName: 'big.pdf', intent: 'draft' }, { storage })).rejects.toMatchObject({
      message: 'PDFs can be at most 50 MB.',
    });
    const key2 = `pending/${adminCtx.admin.id}/00000000-0000-4000-8000-000000000002.pdf`;
    storage.put(key2, fakePdf(), 'text/html');
    await expect(createReport(adminCtx, { ...details(), uploadKey: key2, fileName: 'x.pdf', intent: 'draft' }, { storage })).rejects.toMatchObject({
      message: 'Only PDF files can be uploaded.',
    });
    expect(storage.keys()).toEqual([]);
  });

  it("refuses another admin's upload", async () => {
    const u = await upload(superCtx);
    await expect(createReport(adminCtx, { ...details(), ...u, intent: 'draft' }, { storage })).rejects.toMatchObject({ code: 'upload_invalid' });
    expect(storage.keys('pending/')).toHaveLength(1); // the owner's upload is untouched
  });

  it('an expired upload URL cannot be used, and nothing is created', async () => {
    let t = Date.now();
    storage.now = () => t;
    const issued = await requestReportUpload(adminCtx, { fileName: 'r.pdf', contentType: 'application/pdf', size: 2048 }, { storage });
    t += 6 * 60 * 1000;
    await expect(storage.simulateBrowserUpload(issued.url, fakePdf())).rejects.toThrow(/expired/);
    await expect(
      createReport(adminCtx, { ...details(), uploadKey: issued.uploadKey, fileName: 'r.pdf', intent: 'draft' }, { storage }),
    ).rejects.toMatchObject({ code: 'upload_missing' });
  });

  it('a file of a different size than declared is refused by the signed URL', async () => {
    const issued = await requestReportUpload(adminCtx, { fileName: 'r.pdf', contentType: 'application/pdf', size: 1000 }, { storage });
    await expect(storage.simulateBrowserUpload(issued.url, fakePdf(MAX_PDF_BYTES))).rejects.toThrow(/content-length/);
  });

  it('storage not configured: clear error, no upload URL, no report', async () => {
    expect(getStorage().kind).toBe('unconfigured'); // tests have no R2 credentials — like the app today
    await expect(requestReportUpload(adminCtx, { fileName: 'r.pdf', contentType: 'application/pdf', size: 10 })).rejects.toMatchObject({
      code: 'storage_unavailable',
    });
    await expect(
      createReport(adminCtx, { ...details(), uploadKey: `pending/${adminCtx.admin.id}/00000000-0000-4000-8000-000000000003.pdf`, fileName: 'r.pdf', intent: 'draft' }),
    ).rejects.toMatchObject({ code: 'storage_unavailable' });
  });

  it('a storage failure during the copy: safe error, upload kept for retry, no report', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const u = await upload(adminCtx);
    storage.failOn('copy');
    await expect(createReport(adminCtx, { ...details(), ...u, intent: 'draft' }, { storage })).rejects.toMatchObject({ code: 'storage_error' });
    expect(await db().report.count()).toBe(0);
    expect(storage.keys('pending/')).toEqual([u.uploadKey]);
    const retry = await createReport(adminCtx, { ...details(), ...u, intent: 'draft' }, { storage });
    expect(retry.duplicate).toBe(false);
  });

  it('a database failure after the copy: the copy is removed, the upload is kept, a retry works', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const u = await upload(adminCtx);
    await expect(createReport(adminCtx, { ...details({ title: 'FAIL-INSERT test' }), ...u, intent: 'draft' }, { storage })).rejects.toMatchObject({
      code: 'save_failed',
    });
    expect(await db().report.count()).toBe(0);
    expect(storage.keys('reports/')).toEqual([]); // no orphan
    expect(storage.keys('pending/')).toEqual([u.uploadKey]); // retry possible
    expect(errorLog.mock.calls.flat().join(' ')).not.toMatch(/postgres(ql)?:\/\/|password/i); // logged safely
    const retry = await createReport(adminCtx, { ...details(), ...u, intent: 'draft' }, { storage });
    expect(storage.keys()).toEqual([(await db().report.findUniqueOrThrow({ where: { id: retry.id } })).fileKey]);
  });

  it('if the pending copy cannot be removed afterwards, the report still saves with a warning', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const u = await upload(adminCtx);
    storage.failOn('delete', { keyPrefix: 'pending/' });
    const r = await createReport(adminCtx, { ...details(), ...u, intent: 'draft' }, { storage });
    expect(r.warnings[0]).toMatch(/expire automatically/);
    expect(await db().report.count()).toBe(1);
  });

  it(`rate-limits upload URLs per admin`, async () => {
    const now = new Date();
    for (let i = 0; i < 60; i++) await requestReportUpload(adminCtx, { fileName: 'r.pdf', contentType: 'application/pdf', size: 10 }, { storage, now });
    await expect(requestReportUpload(adminCtx, { fileName: 'r.pdf', contentType: 'application/pdf', size: 10 }, { storage, now })).rejects.toMatchObject({
      code: 'rate_limited',
    });
    // Another admin is unaffected.
    await expect(requestReportUpload(superCtx, { fileName: 'r.pdf', contentType: 'application/pdf', size: 10 }, { storage, now })).resolves.toBeDefined();
  });
});

describe('replacing the PDF', () => {
  it('swaps the file, removes the old one only afterwards, keeps status and slug, audits', async () => {
    const r = await create(adminCtx, {}, 'publish');
    const before = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    const u = await upload(adminCtx, fakePdf(4096), 'corrected.pdf');
    const out = await replaceReportFile(adminCtx, r.id, u, { storage });
    expect(out).toEqual({ duplicate: false, warnings: [] });
    const after = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    expect(after).toMatchObject({ fileName: 'corrected.pdf', fileSize: 4096, status: 'PUBLISHED', slug: before.slug });
    expect(after.fileKey).not.toBe(before.fileKey);
    expect(storage.keys()).toEqual([after.fileKey]);
    expect(await auditActions(r.id)).toContain('REPORT_FILE_REPLACED');
    expect(await replaceReportFile(adminCtx, r.id, u, { storage })).toEqual({ duplicate: true, warnings: [] }); // resubmit is harmless
  });

  it('an invalid replacement leaves the report and its current file untouched', async () => {
    const r = await create(adminCtx);
    const before = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    const u = await upload(adminCtx, notAPdf());
    await expect(replaceReportFile(adminCtx, r.id, u, { storage })).rejects.toMatchObject({ code: 'upload_invalid' });
    expect(await db().report.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ fileKey: before.fileKey });
    expect(storage.keys()).toEqual([before.fileKey]);
  });

  it('a database failure during replacement: new copy removed, old file still served', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await create(adminCtx);
    const before = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    const u = await upload(adminCtx, fakePdf(), 'fail-update.pdf');
    await expect(replaceReportFile(adminCtx, r.id, u, { storage })).rejects.toMatchObject({ code: 'save_failed' });
    expect((await db().report.findUniqueOrThrow({ where: { id: r.id } })).fileKey).toBe(before.fileKey);
    expect(storage.keys('reports/')).toEqual([before.fileKey]);
  });

  it('if the old file cannot be removed, the replacement still succeeds with a warning', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await create(adminCtx);
    const before = await db().report.findUniqueOrThrow({ where: { id: r.id } });
    const u = await upload(adminCtx);
    storage.failOn('delete', { keyPrefix: before.fileKey });
    const out = await replaceReportFile(adminCtx, r.id, u, { storage });
    expect(out.warnings[0]).toMatch(/previous PDF could not be removed/);
    expect((await db().report.findUniqueOrThrow({ where: { id: r.id } })).fileKey).not.toBe(before.fileKey);
    // The orphan can be found again from the audit log.
    const audit = await db().auditLog.findFirstOrThrow({ where: { action: 'REPORT_FILE_REPLACED', targetId: r.id } });
    expect(audit.metadata).toMatchObject({ previousFileKey: before.fileKey });
  });
});

// ------------------------------------------------------------ public access --

describe('public access', () => {
  it('only published reports are listed or found by slug', async () => {
    const published = await create(adminCtx, { title: 'TEST Published' }, 'publish');
    const draft = await create(adminCtx, { title: 'TEST Draft' });
    const archived = await create(adminCtx, { title: 'TEST Archived' }, 'publish');
    await archiveReport(adminCtx, archived.id);

    const list = await listPublishedReports({ pageSize: 50 });
    expect(list.items.map((i) => i.title)).toEqual(['TEST Published']);
    expect(await getPublishedReportBySlug(published.slug)).not.toBeNull();
    expect(await getPublishedReportBySlug(draft.slug)).toBeNull();
    expect(await getPublishedReportBySlug(archived.slug)).toBeNull();
    for (const bad of ['does-not-exist', '../etc', 'UPPER', '', 'a'.repeat(200)]) expect(await getPublishedReportBySlug(bad)).toBeNull();
  });

  it('file links: published only for the public; any status for admins', async () => {
    const published = await create(adminCtx, {}, 'publish');
    const draft = await create(adminCtx);
    const url = await createPublicFileUrl(published.slug, 'attachment', { storage });
    expect(url.url).toMatch(/^memory:\/\/download\/reports\//);
    await expect(createPublicFileUrl(draft.slug, 'attachment', { storage })).rejects.toMatchObject({ code: 'not_found' });
    await expect(createPublicFileUrl('nope', 'inline', { storage })).rejects.toMatchObject({ code: 'not_found' });
    await expect(createAdminFileUrl(adminCtx, draft.id, 'inline', { storage })).resolves.toMatchObject({ url: expect.stringMatching(/^memory:/) });
    // Archiving revokes public access immediately (no new links are issued).
    await archiveReport(adminCtx, published.id);
    await expect(createPublicFileUrl(published.slug, 'attachment', { storage })).rejects.toMatchObject({ code: 'not_found' });
  });

  it('preview links live longer than download links', async () => {
    const r = await create(adminCtx, {}, 'publish');
    const inline = await createPublicFileUrl(r.slug, 'inline', { storage });
    const download = await createPublicFileUrl(r.slug, 'attachment', { storage });
    expect(inline.expiresAt.getTime()).toBeGreaterThan(download.expiresAt.getTime());
  });

  it('filters: category, title search, exact date, range, month and year; sorting and paging', async () => {
    for (const [title, category, reportDate] of [
      ['TEST Iron ore daily', 'GLOBAL', '2026-11-05'],
      ['TEST Coal freight', 'DOMESTIC', '2026-11-04'],
      ['TEST Special monsoon note', 'SPECIAL', '2026-10-15'],
      ['TEST Iron ore annual', 'GLOBAL', '2025-12-31'],
    ] as const) {
      await create(adminCtx, { title, category, reportDate }, 'publish');
    }
    const run = (params: Record<string, string>, extra: Record<string, unknown> = {}) =>
      listPublishedReports({ ...dateBounds(resolveDateFilter(params)), pageSize: 50, ...extra });

    expect((await run({}, { category: 'GLOBAL' })).total).toBe(2);
    expect((await run({}, { query: 'iron ORE' })).total).toBe(2);
    expect((await run({ date: '2026-11-04' })).items.map((i) => i.title)).toEqual(['TEST Coal freight']);
    expect((await run({ from: '2026-10-01', to: '2026-11-04' })).total).toBe(2);
    expect((await run({ year: '2026', month: '11' })).total).toBe(2);
    expect((await run({ year: '2025' })).items.map((i) => i.title)).toEqual(['TEST Iron ore annual']);

    const newest = await run({});
    expect(newest.items.map((i) => i.reportDate)).toEqual(['2026-11-05', '2026-11-04', '2026-10-15', '2025-12-31']);
    const oldest = await run({}, { sort: 'oldest' });
    expect(oldest.items.map((i) => i.reportDate)).toEqual(['2025-12-31', '2026-10-15', '2026-11-04', '2026-11-05']);
    const page2 = await listPublishedReports({ page: 2, pageSize: 3 });
    expect(page2).toMatchObject({ total: 4, totalPages: 2, hasPreviousPage: true, hasNextPage: false });
    expect(page2.items).toHaveLength(1);
  });

  it('the admin list sees every status and can filter by one', async () => {
    await create(adminCtx, {}, 'publish');
    await create(adminCtx);
    expect((await listReports({ pageSize: 50 })).total).toBe(2);
    expect((await listReports({ status: 'DRAFT' })).total).toBe(1);
  });
});

// -------------------------------------------------------------- permissions --

describe('permissions', () => {
  it('an ADMIN can create, edit, replace, publish, archive and restore', async () => {
    const r = await create(adminCtx);
    await updateReport(adminCtx, r.id, details({ title: 'TEST edited by admin' }));
    await replaceReportFile(adminCtx, r.id, await upload(adminCtx), { storage });
    await publishReport(adminCtx, r.id);
    await archiveReport(adminCtx, r.id);
    await restoreReport(adminCtx, r.id);
    expect(await auditActions(r.id)).toEqual([
      'REPORT_UPLOADED',
      'REPORT_UPDATED',
      'REPORT_FILE_REPLACED',
      'REPORT_PUBLISHED',
      'REPORT_ARCHIVED',
      'REPORT_RESTORED',
    ]);
  });

  it('every audit record names the admin who acted', async () => {
    const r = await create(adminCtx, {}, 'publish');
    const rows = await db().auditLog.findMany({ where: { targetId: r.id } });
    expect(rows.every((a) => a.actorId === adminCtx.admin.id)).toBe(true);
    expect(rows.every((a) => a.ipAddress === REQUEST.ipAddress)).toBe(true);
  });

  it('every refusal is a typed, user-safe error', async () => {
    const r = await create(adminCtx);
    const errors = await Promise.allSettled([
      publishReport(adminCtx, '00000000-0000-4000-8000-000000000000'),
      updateReport(adminCtx, 'not-a-uuid', details()),
      archiveReport(adminCtx, r.id).then(() => archiveReport(adminCtx, r.id)),
    ]);
    for (const e of errors) {
      expect(e.status).toBe('rejected');
      const reason = (e as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(ReportError);
      expect(reason.message).not.toMatch(/prisma|sql|stack|incworx\./i);
    }
  });
});
