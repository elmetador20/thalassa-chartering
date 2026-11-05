import 'server-only';
import type { AuditAction, ReportStatus } from '@/generated/prisma/client';
import { can, type Permission } from '@/lib/auth/permissions';
import {
  DOWNLOAD_URL_TTL_SECONDS,
  MAX_PDF_BYTES,
  PDF_MAGIC_BYTES,
  PDF_MIME_TYPE,
  PREVIEW_URL_TTL_SECONDS,
  UPLOAD_URL_TTL_SECONDS,
} from '@/lib/reports/constants';
import { toFieldErrors } from '@/lib/validation/auth';
import { createReportSchema, replaceFileSchema, reportDetailsSchema, reportIdSchema, uploadRequestSchema } from '@/lib/validation/reports';
import { recordAudit, type RequestMeta } from '../audit';
import { ForbiddenError } from '../auth/errors';
import { consumeRateLimit, REPORT_UPLOAD_RATE_LIMIT } from '../auth/rate-limit';
import type { AuthContext } from '../auth/session';
import { getDb, type DbTx } from '../db';
import { describeErrorSafely } from '../safe-error';
import { getStorage, StorageError, StorageNotConfiguredError, type PresignedDownload, type ReportStorage } from '../storage';
import { safePdfFileName } from './content-disposition';
import { formatDateOnly, parseDateOnly } from './dates';
import { ReportError, STORAGE_UNAVAILABLE_MESSAGE } from './errors';
import { newPendingUploadKey, parsePendingUploadKey, reportFileKeyForUpload } from './file-key';
import { newReportSlug } from './slug';

// ============================================================================
// Report management.
//
// Every function takes the verified AuthContext of the person acting and
// checks the permission itself, and validates its own input — so the server
// action, the API route and the tests all pass through the same gates.
//
// Storage work happens OUTSIDE database transactions (a slow R2 call never
// holds a connection), in an order that leaves nothing behind on failure:
//
//   create   verify upload → copy to reports/ → insert row + audit (one tx)
//            → delete the pending copy.   Insert fails → delete the copy,
//            keep the pending upload so the admin can simply retry.
//   replace  same, then delete the OLD file only after the row points at the
//            new one — a failure never leaves a report without its PDF.
//   delete   remove row + audit (one tx), then the file. If the file cannot
//            be removed the audit record keeps its key for reconciliation.
//
// Status changes are conditional updates ("… where status = X"), so two
// admins clicking at once cannot both win.
// ============================================================================

export interface ReportServiceOptions {
  /** Injected in tests; production always uses getStorage(). */
  storage?: ReportStorage;
  request?: RequestMeta | null;
  now?: Date;
}

function assertPermission(ctx: AuthContext, permission: Permission): void {
  if (!can(ctx.admin.role, permission)) throw new ForbiddenError();
}

function parseReportId(value: unknown): string {
  const parsed = reportIdSchema.safeParse(value);
  if (!parsed.success) throw new ReportError('not_found', 'Report not found.');
  return parsed.data;
}

function storageOf(options: ReportServiceOptions): ReportStorage {
  return options.storage ?? getStorage();
}

/** Turns storage failures into safe, user-facing errors (and logs detail safely). */
async function withStorage<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) throw new ReportError('storage_unavailable', STORAGE_UNAVAILABLE_MESSAGE);
    if (error instanceof StorageError) {
      console.error(`[reports] storage ${error.operation} failed: ${describeErrorSafely(error)}`);
      throw new ReportError('storage_error', 'The file storage could not be reached. Please try again in a moment.');
    }
    throw error;
  }
}

/** Best-effort delete; never throws. Returns whether it worked. */
async function tryDelete(storage: ReportStorage, key: string, purpose: string): Promise<boolean> {
  try {
    await storage.delete(key);
    return true;
  } catch (error) {
    console.warn(`[reports] could not delete ${key} (${purpose}): ${describeErrorSafely(error)}`);
    return false;
  }
}

function uniqueViolation(error: unknown): 'file_key' | 'slug' | 'other' | null {
  if ((error as { code?: string })?.code !== 'P2002') return null;
  const text = `${(error as Error).message} ${JSON.stringify((error as { meta?: unknown }).meta ?? {})}`;
  if (/file_key/.test(text)) return 'file_key';
  if (/slug/.test(text)) return 'slug';
  return 'other';
}

// ------------------------------------------------------------------ upload --

export interface IssuedUpload {
  uploadKey: string;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}

/** Step 1 of an upload: validate what the browser declares, issue a
 *  short-lived URL locked to this exact size and type. */
export async function requestReportUpload(ctx: AuthContext, raw: unknown, options: ReportServiceOptions = {}): Promise<IssuedUpload> {
  if (!can(ctx.admin.role, 'reports:create') && !can(ctx.admin.role, 'reports:replace-file')) throw new ForbiddenError();

  const parsed = uploadRequestSchema.safeParse(raw);
  if (!parsed.success) throw new ReportError('validation', 'This file cannot be uploaded.', toFieldErrors(parsed.error));

  const storage = storageOf(options);
  // Don't spend a rate-limit slot on an upload that cannot happen.
  if (storage.kind === 'unconfigured') throw new ReportError('storage_unavailable', STORAGE_UNAVAILABLE_MESSAGE);

  const limit = await consumeRateLimit({ key: `report-upload:${ctx.admin.id}`, ...REPORT_UPLOAD_RATE_LIMIT }, options.now);
  if (limit.limited) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60000));
    throw new ReportError('rate_limited', `Too many uploads started. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const { key } = newPendingUploadKey(ctx.admin.id);
  const upload = await withStorage(() =>
    storage.createUploadUrl({ key, contentType: PDF_MIME_TYPE, contentLength: parsed.data.size, expiresInSeconds: UPLOAD_URL_TTL_SECONDS }),
  );
  return { uploadKey: key, url: upload.url, method: upload.method, headers: upload.headers, expiresAt: upload.expiresAt.toISOString(), maxBytes: MAX_PDF_BYTES };
}

/**
 * Step 2: check what actually arrived. The key must belong to this admin; the
 * object must exist, be 1 byte–50 MB, be stored as application/pdf, and start
 * with the PDF signature. A rejected upload is deleted straight away.
 */
async function verifyUpload(storage: ReportStorage, ctx: AuthContext, uploadKey: string): Promise<{ uploadId: string; size: number }> {
  const pending = parsePendingUploadKey(uploadKey);
  if (!pending || pending.adminId !== ctx.admin.id) {
    throw new ReportError('upload_invalid', 'This upload does not belong to your session. Upload the PDF again.');
  }
  const info = await withStorage(() => storage.head(uploadKey));
  if (!info) throw new ReportError('upload_missing', 'The uploaded file was not found — the upload may have failed or expired. Upload the PDF again.');

  const reject = async (message: string) => {
    await tryDelete(storage, uploadKey, 'rejected upload');
    return new ReportError('upload_invalid', message);
  };
  if (info.size <= 0) throw await reject('The uploaded file is empty.');
  if (info.size > MAX_PDF_BYTES) throw await reject('PDFs can be at most 50 MB.');
  if ((info.contentType ?? '').toLowerCase() !== PDF_MIME_TYPE) throw await reject('Only PDF files can be uploaded.');
  const start = await withStorage(() => storage.readStart(uploadKey, PDF_MAGIC_BYTES.length));
  if (new TextDecoder().decode(start) !== PDF_MAGIC_BYTES) throw await reject('This file is not a valid PDF.');

  return { uploadId: pending.uploadId, size: info.size };
}

// ------------------------------------------------------------------ create --

export interface CreatedReport {
  id: string;
  slug: string;
  status: ReportStatus;
  /** True when this upload had already become a report (double submit). */
  duplicate: boolean;
  warnings: string[];
}

export async function createReport(ctx: AuthContext, raw: unknown, options: ReportServiceOptions = {}): Promise<CreatedReport> {
  assertPermission(ctx, 'reports:create');
  const parsed = createReportSchema.safeParse(raw);
  if (!parsed.success) throw new ReportError('validation', 'Check the highlighted fields.', toFieldErrors(parsed.error));
  const input = parsed.data;
  const publish = input.intent === 'publish';
  if (publish) assertPermission(ctx, 'reports:publish');

  const storage = storageOf(options);
  const db = getDb();
  const select = { id: true, slug: true, status: true } as const;

  // A resubmitted upload that already became a report: return it, do nothing.
  const pending = parsePendingUploadKey(input.uploadKey);
  if (pending && pending.adminId === ctx.admin.id) {
    const existing = await db.report.findUnique({ where: { fileKey: reportFileKeyForUpload(pending.uploadId) }, select });
    if (existing) return { ...existing, duplicate: true, warnings: [] };
  }

  const { uploadId, size } = await verifyUpload(storage, ctx, input.uploadKey);
  const fileKey = reportFileKeyForUpload(uploadId);
  await withStorage(() => storage.copy(input.uploadKey, fileKey));

  const now = options.now ?? new Date();
  const fileName = safePdfFileName(input.fileName);
  let created: { id: string; slug: string; status: ReportStatus };
  try {
    created = await insertReport(async (tx, slug) => {
      const report = await tx.report.create({
        data: {
          title: input.title,
          slug,
          description: input.description,
          category: input.category,
          reportDate: parseDateOnly(input.reportDate)!,
          fileName,
          fileKey,
          fileSize: size,
          mimeType: PDF_MIME_TYPE,
          status: publish ? 'PUBLISHED' : 'DRAFT',
          publishedAt: publish ? now : null,
          createdById: ctx.admin.id,
        },
        select,
      });
      const target = { actorId: ctx.admin.id, targetType: 'report' as const, targetId: report.id, request: options.request };
      await recordAudit(tx, {
        action: 'REPORT_UPLOADED',
        ...target,
        metadata: { title: input.title, category: input.category, reportDate: input.reportDate, fileName, fileSize: size, status: report.status },
      });
      if (publish) await recordAudit(tx, { action: 'REPORT_PUBLISHED', ...target, metadata: { title: input.title, firstPublication: true } });
      return report;
    }, input.title, input.reportDate);
  } catch (error) {
    if (uniqueViolation(error) === 'file_key') {
      // Lost a race with a simultaneous submit of the same upload: that one won.
      const existing = await db.report.findUnique({ where: { fileKey }, select });
      if (existing) return { ...existing, duplicate: true, warnings: [] };
    }
    // Remove the copy — unless some report already references it.
    if (!(await db.report.findUnique({ where: { fileKey }, select: { id: true } }))) await tryDelete(storage, fileKey, 'unsaved report');
    console.error(`[reports] create failed: ${describeErrorSafely(error)}`);
    throw new ReportError('save_failed', 'The report could not be saved. Your upload is kept — please try again.');
  }

  const warnings: string[] = [];
  if (!(await tryDelete(storage, input.uploadKey, 'finalised upload'))) {
    warnings.push('The temporary upload could not be removed; it will expire automatically within a day.');
  }
  return { ...created, duplicate: false, warnings };
}

/** Inserts with a fresh random slug, retrying on the (astronomically rare) collision. */
async function insertReport<T>(write: (tx: DbTx, slug: string) => Promise<T>, title: string, reportDate: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await getDb().$transaction((tx) => write(tx, newReportSlug(title, reportDate)));
    } catch (error) {
      if (uniqueViolation(error) === 'slug' && attempt < 3) continue;
      throw error;
    }
  }
}

// ------------------------------------------------------------------ update --

/** Edits title, category, report date and description. Never touches status. */
export async function updateReport(ctx: AuthContext, id: unknown, raw: unknown, options: ReportServiceOptions = {}): Promise<{ slug: string; changed: string[] }> {
  assertPermission(ctx, 'reports:update');
  const reportId = parseReportId(id);
  const parsed = reportDetailsSchema.safeParse(raw);
  if (!parsed.success) throw new ReportError('validation', 'Check the highlighted fields.', toFieldErrors(parsed.error));
  const next = parsed.data;

  return getDb().$transaction(async (tx) => {
    const current = await tx.report.findUnique({
      where: { id: reportId },
      select: { title: true, category: true, reportDate: true, description: true, slug: true },
    });
    if (!current) throw new ReportError('not_found', 'Report not found.');

    const changed = [
      current.title !== next.title && 'title',
      current.category !== next.category && 'category',
      formatDateOnly(current.reportDate) !== next.reportDate && 'reportDate',
      (current.description ?? null) !== next.description && 'description',
    ].filter(Boolean) as string[];
    if (changed.length === 0) return { slug: current.slug, changed };

    await tx.report.update({
      where: { id: reportId },
      data: { title: next.title, category: next.category, reportDate: parseDateOnly(next.reportDate)!, description: next.description },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: 'REPORT_UPDATED',
      actorId: ctx.admin.id,
      targetType: 'report',
      targetId: reportId,
      metadata: { title: next.title, changed: changed.join(',') },
      request: options.request,
    });
    return { slug: current.slug, changed };
  });
}

// ------------------------------------------------------------ replace file --

export async function replaceReportFile(
  ctx: AuthContext,
  id: unknown,
  raw: unknown,
  options: ReportServiceOptions = {},
): Promise<{ duplicate: boolean; warnings: string[] }> {
  assertPermission(ctx, 'reports:replace-file');
  const reportId = parseReportId(id);
  const parsed = replaceFileSchema.safeParse(raw);
  if (!parsed.success) throw new ReportError('validation', 'Upload a PDF first.', toFieldErrors(parsed.error));
  const { uploadKey } = parsed.data;
  const fileName = safePdfFileName(parsed.data.fileName);

  const storage = storageOf(options);
  const db = getDb();
  const report = await db.report.findUnique({ where: { id: reportId }, select: { id: true, title: true, fileKey: true, fileName: true } });
  if (!report) throw new ReportError('not_found', 'Report not found.');

  const pending = parsePendingUploadKey(uploadKey);
  if (pending && reportFileKeyForUpload(pending.uploadId) === report.fileKey) return { duplicate: true, warnings: [] }; // already applied

  const { uploadId, size } = await verifyUpload(storage, ctx, uploadKey);
  const newKey = reportFileKeyForUpload(uploadId);
  await withStorage(() => storage.copy(uploadKey, newKey));

  try {
    await db.$transaction(async (tx) => {
      // Only if nobody replaced it meanwhile.
      const { count } = await tx.report.updateMany({
        where: { id: reportId, fileKey: report.fileKey },
        data: { fileKey: newKey, fileName, fileSize: size, mimeType: PDF_MIME_TYPE },
      });
      if (count === 0) throw new ReportError('conflict', 'This report was changed while you were uploading. Reload the page and try again.');
      await recordAudit(tx, {
        action: 'REPORT_FILE_REPLACED',
        actorId: ctx.admin.id,
        targetType: 'report',
        targetId: reportId,
        // The old key stays on record in case its deletion below fails.
        metadata: { title: report.title, previousFileName: report.fileName, previousFileKey: report.fileKey, fileName, fileSize: size },
        request: options.request,
      });
    });
  } catch (error) {
    if (!(await db.report.findUnique({ where: { fileKey: newKey }, select: { id: true } }))) await tryDelete(storage, newKey, 'unsaved replacement');
    if (error instanceof ReportError) throw error;
    if (uniqueViolation(error) === 'file_key') return { duplicate: true, warnings: [] };
    console.error(`[reports] replace failed: ${describeErrorSafely(error)}`);
    throw new ReportError('save_failed', 'The PDF could not be replaced. The current file is unchanged — please try again.');
  }

  // Only now, with the row pointing at the new file, remove the old one.
  const warnings: string[] = [];
  if (!(await tryDelete(storage, report.fileKey, 'replaced file'))) {
    warnings.push('The previous PDF could not be removed from storage; the storage reconciliation check will list it.');
  }
  if (!(await tryDelete(storage, uploadKey, 'finalised upload'))) {
    warnings.push('The temporary upload could not be removed; it will expire automatically within a day.');
  }
  return { duplicate: false, warnings };
}

// ---------------------------------------------------------------- status --

async function changeStatus(
  ctx: AuthContext,
  id: unknown,
  options: ReportServiceOptions,
  spec: {
    permission: Permission;
    from: ReportStatus[];
    refuse: Partial<Record<ReportStatus, string>>;
    data: (current: { publishedAt: Date | null }, now: Date) => { status: ReportStatus; publishedAt?: Date; archivedAt?: Date | null };
    audit: AuditAction;
    metadata: (current: { title: string; status: ReportStatus; publishedAt: Date | null }) => Record<string, string | boolean | null>;
  },
): Promise<{ slug: string }> {
  assertPermission(ctx, spec.permission);
  const reportId = parseReportId(id);
  const now = options.now ?? new Date();

  return getDb().$transaction(async (tx) => {
    const current = await tx.report.findUnique({ where: { id: reportId }, select: { title: true, slug: true, status: true, publishedAt: true } });
    if (!current) throw new ReportError('not_found', 'Report not found.');
    if (!spec.from.includes(current.status)) {
      throw new ReportError('invalid_transition', spec.refuse[current.status] ?? 'That change is not possible for this report.');
    }
    const { count } = await tx.report.updateMany({ where: { id: reportId, status: current.status }, data: spec.data(current, now) });
    if (count === 0) throw new ReportError('conflict', 'This report was changed by someone else. Reload the page and try again.');
    await recordAudit(tx, {
      action: spec.audit,
      actorId: ctx.admin.id,
      targetType: 'report',
      targetId: reportId,
      metadata: spec.metadata(current),
      request: options.request,
    });
    return { slug: current.slug };
  });
}

/** Draft → Published. Sets publishedAt only the FIRST time. */
export function publishReport(ctx: AuthContext, id: unknown, options: ReportServiceOptions = {}) {
  return changeStatus(ctx, id, options, {
    permission: 'reports:publish',
    from: ['DRAFT'],
    refuse: { PUBLISHED: 'This report is already published.', ARCHIVED: 'Restore this report before publishing it.' },
    data: (current, now) => ({ status: 'PUBLISHED', publishedAt: current.publishedAt ?? now }),
    audit: 'REPORT_PUBLISHED',
    metadata: (current) => ({ title: current.title, firstPublication: current.publishedAt === null }),
  });
}

/** Draft or Published → Archived. Removes it from the public site at once. */
export function archiveReport(ctx: AuthContext, id: unknown, options: ReportServiceOptions = {}) {
  return changeStatus(ctx, id, options, {
    permission: 'reports:archive',
    from: ['DRAFT', 'PUBLISHED'],
    refuse: { ARCHIVED: 'This report is already archived.' },
    data: (_current, now) => ({ status: 'ARCHIVED', archivedAt: now }),
    audit: 'REPORT_ARCHIVED',
    metadata: (current) => ({ title: current.title, previousStatus: current.status }),
  });
}

/** Archived → Draft. The first-publication date is kept for the record. */
export function restoreReport(ctx: AuthContext, id: unknown, options: ReportServiceOptions = {}) {
  return changeStatus(ctx, id, options, {
    permission: 'reports:archive',
    from: ['ARCHIVED'],
    refuse: { DRAFT: 'Only archived reports can be restored.', PUBLISHED: 'Only archived reports can be restored.' },
    data: () => ({ status: 'DRAFT', archivedAt: null }),
    audit: 'REPORT_RESTORED',
    metadata: (current) => ({ title: current.title }),
  });
}

// ------------------------------------------------------------------ delete --

/**
 * Permanent deletion — Super Admin only, and only when the exact report title
 * is typed as confirmation (checked here, not just in the browser).
 */
export async function deleteReport(
  ctx: AuthContext,
  id: unknown,
  confirmation: unknown,
  options: ReportServiceOptions = {},
): Promise<{ slug: string; warnings: string[] }> {
  assertPermission(ctx, 'reports:delete');
  const reportId = parseReportId(id);
  const storage = storageOf(options);
  // Without storage the file could not be removed and would be orphaned.
  if (storage.kind === 'unconfigured') {
    throw new ReportError('storage_unavailable', 'Reports cannot be deleted until PDF storage is connected, so that no file is left behind.');
  }

  const db = getDb();
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { title: true, slug: true, fileKey: true, fileName: true, status: true },
  });
  if (!report) throw new ReportError('not_found', 'Report not found.');
  if (typeof confirmation !== 'string' || confirmation.trim() !== report.title) {
    throw new ReportError('confirmation', 'Type the report title exactly to confirm.', { confirmation: ['Type the report title exactly to confirm.'] });
  }

  await db.$transaction(async (tx) => {
    await tx.report.delete({ where: { id: reportId } });
    await recordAudit(tx, {
      action: 'REPORT_DELETED',
      actorId: ctx.admin.id,
      targetType: 'report',
      targetId: reportId,
      // The key stays in the audit trail so an orphaned file can be found.
      metadata: { title: report.title, slug: report.slug, fileName: report.fileName, fileKey: report.fileKey, status: report.status },
      request: options.request,
    });
  });

  const removed = await tryDelete(storage, report.fileKey, 'deleted report');
  return {
    slug: report.slug,
    warnings: removed ? [] : ['The report was deleted, but its PDF could not be removed from storage. The storage reconciliation check will list it.'],
  };
}

// ------------------------------------------------------------- file access --

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A short-lived link to a PUBLISHED report's PDF. Anything else is "not found". */
export async function createPublicFileUrl(
  slug: string,
  disposition: 'inline' | 'attachment',
  options: ReportServiceOptions = {},
): Promise<PresignedDownload> {
  if (!SLUG_SHAPE.test(slug) || slug.length > 160) throw new ReportError('not_found', 'Report not found.');
  const report = await getDb().report.findFirst({ where: { slug, status: 'PUBLISHED' }, select: { fileKey: true, fileName: true } });
  if (!report) throw new ReportError('not_found', 'Report not found.');
  const storage = storageOf(options);
  return withStorage(() =>
    storage.createDownloadUrl({
      key: report.fileKey,
      fileName: report.fileName,
      disposition,
      expiresInSeconds: disposition === 'inline' ? PREVIEW_URL_TTL_SECONDS : DOWNLOAD_URL_TTL_SECONDS,
    }),
  );
}

/** A short-lived link to any report's PDF, for signed-in admins (drafts too). */
export async function createAdminFileUrl(
  ctx: AuthContext,
  id: unknown,
  disposition: 'inline' | 'attachment',
  options: ReportServiceOptions = {},
): Promise<PresignedDownload> {
  assertPermission(ctx, 'reports:view');
  const reportId = parseReportId(id);
  const report = await getDb().report.findUnique({ where: { id: reportId }, select: { fileKey: true, fileName: true } });
  if (!report) throw new ReportError('not_found', 'Report not found.');
  const storage = storageOf(options);
  return withStorage(() =>
    storage.createDownloadUrl({
      key: report.fileKey,
      fileName: report.fileName,
      disposition,
      expiresInSeconds: disposition === 'inline' ? PREVIEW_URL_TTL_SECONDS : DOWNLOAD_URL_TTL_SECONDS,
    }),
  );
}
