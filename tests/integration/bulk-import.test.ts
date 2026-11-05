import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/lib/server/db';
import { checkImportRows, commitImportRow, requestImportUpload } from '@/lib/server/reports/bulk-import';
import { createReport, requestReportUpload } from '@/lib/server/reports/service';
import { reconcileStorage } from '@/lib/server/storage/reconcile';
import type { AuthContext } from '@/lib/server/auth/session';
import { addAdmin, contextFor, resetDatabase, seedSuper } from '../support/fixtures';
import { fakePdf, MemoryStorage } from '../support/memory-storage';

const db = () => getDb();
let storage: MemoryStorage;
let ctx: AuthContext;

const row = (o: Record<string, unknown> = {}) => ({
  rowNumber: 2,
  title: 'TEST Historical coal review',
  category: 'Domestic',
  reportDate: '2008-03-14',
  description: 'TEST import row.',
  fileName: 'coal-2008.pdf',
  status: 'Published',
  fileSize: 3000,
  ...o,
});

/** The browser's part for one row: upload URL → PUT → commit. */
async function importRow(r: ReturnType<typeof row>) {
  const issued = await requestImportUpload(ctx, r, { storage });
  if (issued.alreadyImported) return { already: issued.alreadyImported };
  await storage.simulateBrowserUpload(issued.upload.url, fakePdf(r.fileSize as number));
  const uploadKey = issued.upload.uploadKey;
  return { created: await commitImportRow(ctx, { ...r, uploadKey }, { storage }), uploadKey };
}

beforeEach(async () => {
  await resetDatabase();
  storage = new MemoryStorage();
  const superCtx = await seedSuper();
  ctx = await contextFor(await addAdmin(superCtx, { name: 'Ravi Kumar', email: 'ravi@incworx.test' }, { approve: true }));
});

describe('bulk import', () => {
  it('imports a historical row with its original date and status, audited as an import', async () => {
    const { created } = await importRow(row());
    const report = await db().report.findUniqueOrThrow({ where: { id: created!.id } });
    expect(report).toMatchObject({ status: 'PUBLISHED', category: 'DOMESTIC', fileName: 'coal-2008.pdf', fileSize: 3000 });
    expect(report.reportDate.toISOString().slice(0, 10)).toBe('2008-03-14');
    const audit = await db().auditLog.findFirstOrThrow({ where: { action: 'REPORT_UPLOADED', targetId: report.id } });
    expect(audit).toMatchObject({ actorId: ctx.admin.id, metadata: expect.objectContaining({ via: 'bulk-import', csvRow: 2 }) });
    expect(storage.keys('pending/')).toEqual([]);
  });

  it('a retried batch never creates a second report', async () => {
    const first = await importRow(row());
    // Same row again (page reloaded, batch retried): no upload URL, same report.
    const again = await importRow(row());
    expect(again.already?.id).toBe(first.created!.id);
    // The commit replayed directly (e.g. a retried request): also the same report.
    const replay = await commitImportRow(ctx, { ...row(), uploadKey: first.uploadKey }, { storage });
    expect(replay).toMatchObject({ id: first.created!.id, duplicate: true });
    expect(await db().report.count()).toBe(1);
  });

  it('nothing is created when the PDF never arrived', async () => {
    const issued = await requestImportUpload(ctx, row(), { storage });
    await expect(commitImportRow(ctx, { ...row(), uploadKey: issued.upload!.uploadKey }, { storage })).rejects.toMatchObject({ code: 'upload_missing' });
    expect(await db().report.count()).toBe(0);
  });

  it('refuses an upload key that belongs to a different row', async () => {
    const issued = await requestImportUpload(ctx, row(), { storage });
    await storage.simulateBrowserUpload(issued.upload!.url, fakePdf(3000));
    await expect(commitImportRow(ctx, { ...row({ title: 'TEST Another title' }), uploadKey: issued.upload!.uploadKey }, { storage })).rejects.toMatchObject({
      code: 'upload_invalid',
    });
  });

  it('is refused cleanly while storage is not configured', async () => {
    await expect(requestImportUpload(ctx, row())).rejects.toMatchObject({ code: 'storage_unavailable' });
  });

  it('check: validates rows on the server, flags earlier imports and possible duplicates, writes nothing', async () => {
    await importRow(row());
    const issued = await requestReportUpload(ctx, { fileName: 'x.pdf', contentType: 'application/pdf', size: 100 }, { storage });
    await storage.simulateBrowserUpload(issued.url, fakePdf(100));
    await createReport(ctx, { title: 'TEST  existing NOTE', category: 'SPECIAL', reportDate: '2011-05-01', uploadKey: issued.uploadKey, fileName: 'x.pdf', intent: 'draft' }, { storage });
    const before = await db().report.count();

    const { results, storageConfigured } = await checkImportRows(ctx, {
      rows: [
        row(), // imported above
        row({ rowNumber: 3, title: 'TEST Existing note', category: 'Global', reportDate: '2011-05-01', fileName: 'n.pdf' }), // same title + date
        row({ rowNumber: 4, title: 'TEST Brand new', fileName: 'new.pdf' }),
        row({ rowNumber: 5, category: 'Asia', fileName: 'bad.pdf' }),
        row({ rowNumber: 6, title: 'TEST No file yet', fileName: 'later.pdf', fileSize: undefined }),
      ],
    });
    expect(storageConfigured).toBe(false); // the test process has no R2 credentials
    const by = Object.fromEntries(results.map((r) => [r.rowNumber, r]));
    expect(by[2].alreadyImported?.title).toBe('TEST Historical coal review');
    expect(by[3].possibleDuplicates.map((d) => d.title)).toEqual(['TEST  existing NOTE'.replace(/\s+/g, ' ')]);
    expect(by[4]).toMatchObject({ error: null, alreadyImported: null, possibleDuplicates: [] });
    expect(by[5].error).toMatch(/Category/);
    expect(by[6]).toMatchObject({ error: null, alreadyImported: null });
    expect(await db().report.count()).toBe(before);
  });
});

describe('storage reconciliation', () => {
  it('dry run lists orphans, missing files and stale uploads without deleting anything', async () => {
    const { created } = await importRow(row());
    const report = await db().report.findUniqueOrThrow({ where: { id: created!.id } });
    storage.put('reports/00000000-0000-4000-8000-0000000000aa.pdf', fakePdf(10)); // orphan
    storage.put(`pending/${ctx.admin.id}/00000000-0000-4000-8000-0000000000bb.pdf`, fakePdf(10)); // stale upload
    await storage.delete(report.fileKey); // report now missing its file
    const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const dry = await reconcileStorage({ storage, now: later });
    expect(dry.dryRun).toBe(true);
    expect(dry.orphanedFiles.map((o) => o.key)).toEqual(['reports/00000000-0000-4000-8000-0000000000aa.pdf']);
    expect(dry.missingFiles.map((m) => m.reportId)).toEqual([report.id]);
    expect(dry.staleUploads).toHaveLength(1);
    expect(storage.keys()).toHaveLength(2); // nothing removed

    const applied = await reconcileStorage({ storage, now: later, deleteStaleUploads: true });
    expect(applied.deletedUploads).toBe(1);
    expect(storage.keys()).toEqual(['reports/00000000-0000-4000-8000-0000000000aa.pdf']); // orphans are never deleted
  });
});
