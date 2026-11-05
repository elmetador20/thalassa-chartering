import 'server-only';
import { z } from 'zod';
import { can } from '@/lib/auth/permissions';
import {
  describeFieldErrors,
  duplicateFingerprint,
  importRowSchema,
  importRowWithFileSchema,
  MAX_IMPORT_ROWS,
  type ExistingReportRef,
  type ImportCheckResult,
  type ImportRowWithFile,
} from '@/lib/reports/bulk-import';
import { MAX_PDF_BYTES } from '@/lib/reports/constants';
import { toFieldErrors } from '@/lib/validation/auth';
import { uploadKeySchema } from '@/lib/validation/reports';
import { ForbiddenError } from '../auth/errors';
import { REPORT_IMPORT_RATE_LIMIT } from '../auth/rate-limit';
import type { AuthContext } from '../auth/session';
import { getDb } from '../db';
import { getStorage } from '../storage';
import { formatDateOnly, parseDateOnly } from './dates';
import { ReportError } from './errors';
import { importUploadKey, reportFileKeyForUpload } from './file-key';
import { createReport, issueUpload, type CreatedReport, type IssuedUpload, type ReportServiceOptions } from './service';

// ============================================================================
// Bulk import of historical reports, row by row, through the SAME upload and
// creation path as a single report (verify bytes → copy → insert + audit).
//
//   check   validate every row, find rows already imported and existing
//           reports that look like the same report (warnings, never merged)
//   upload  a signed PUT for one row's PDF
//   commit  verify that PDF and create the report
//
// Idempotent: a row's storage key is derived from the row itself (see
// importUploadKey), so retrying a batch can never create a second copy — the
// unique file key lets only one report hold it. A report row is only ever
// written after its PDF is verified and permanently stored.
// ============================================================================

function assertCanImport(ctx: AuthContext, status?: string): void {
  if (!can(ctx.admin.role, 'reports:create')) throw new ForbiddenError();
  if (status === 'PUBLISHED' && !can(ctx.admin.role, 'reports:publish')) {
    throw new ForbiddenError('You do not have permission to publish reports. Set the status to Draft.');
  }
}

/** What makes two import rows "the same upload". */
function rowFingerprint(row: Pick<ImportRowWithFile, 'title' | 'category' | 'reportDate' | 'fileName' | 'fileSize'>): string {
  return `${duplicateFingerprint(row.title, row.reportDate)}|${row.category}|${row.fileName.toLowerCase()}|${row.fileSize}`;
}

export function importKeysFor(ctx: AuthContext, row: ImportRowWithFile) {
  const { key, uploadId } = importUploadKey(ctx.admin.id, rowFingerprint(row));
  return { pendingKey: key, finalKey: reportFileKeyForUpload(uploadId) };
}

// ------------------------------------------------------------------- check --

const checkRowSchema = importRowSchema.extend({
  // The size is known only when a PDF was matched; rows without one are still
  // checked for everything else.
  fileSize: z.number().int().positive().max(MAX_PDF_BYTES).optional(),
});
const checkRequestSchema = z.object({ rows: z.array(z.unknown()).min(1).max(MAX_IMPORT_ROWS) });

const refSelect = { id: true, title: true, slug: true, category: true, reportDate: true, status: true, fileKey: true } as const;

export async function checkImportRows(ctx: AuthContext, raw: unknown): Promise<{ results: ImportCheckResult[]; storageConfigured: boolean }> {
  assertCanImport(ctx);
  const request = checkRequestSchema.safeParse(raw);
  if (!request.success) throw new ReportError('validation', `Send between 1 and ${MAX_IMPORT_ROWS} rows.`);

  const parsed = request.data.rows.map((r) => {
    const result = checkRowSchema.safeParse(r);
    const rowNumber = typeof (r as { rowNumber?: unknown })?.rowNumber === 'number' ? (r as { rowNumber: number }).rowNumber : 0;
    return result.success ? { rowNumber: result.data.rowNumber, row: result.data, error: null } : { rowNumber, row: null, error: describeFieldErrors(toFieldErrors(result.error)) };
  });

  const valid = parsed.filter((p) => p.row);
  const finalKeys = new Map<number, string>();
  for (const p of valid) {
    if (p.row!.fileSize) finalKeys.set(p.rowNumber, importKeysFor(ctx, p.row as ImportRowWithFile).finalKey);
  }
  const dates = [...new Set(valid.map((p) => p.row!.reportDate))].map((d) => parseDateOnly(d)!).filter(Boolean);

  const db = getDb();
  const [byKey, sameDates] = await Promise.all([
    finalKeys.size ? db.report.findMany({ where: { fileKey: { in: [...finalKeys.values()] } }, select: refSelect }) : Promise.resolve([]),
    dates.length ? db.report.findMany({ where: { reportDate: { in: dates } }, select: refSelect }) : Promise.resolve([]),
  ]);

  const toRef = (r: (typeof byKey)[number]): ExistingReportRef => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    category: r.category,
    reportDate: formatDateOnly(r.reportDate),
    status: r.status,
  });
  const keyOwner = new Map(byKey.map((r) => [r.fileKey, r]));
  const byFingerprint = new Map<string, typeof sameDates>();
  for (const r of sameDates) {
    const fp = duplicateFingerprint(r.title, formatDateOnly(r.reportDate));
    byFingerprint.set(fp, [...(byFingerprint.get(fp) ?? []), r]);
  }

  const results = parsed.map<ImportCheckResult>((p) => {
    if (!p.row) return { rowNumber: p.rowNumber, error: p.error, alreadyImported: null, possibleDuplicates: [] };
    const owner = finalKeys.has(p.rowNumber) ? keyOwner.get(finalKeys.get(p.rowNumber)!) : undefined;
    const similar = (byFingerprint.get(duplicateFingerprint(p.row.title, p.row.reportDate)) ?? []).filter((r) => r.id !== owner?.id);
    const publishError =
      p.row.status === 'PUBLISHED' && !can(ctx.admin.role, 'reports:publish') ? 'Status: You can only import reports as Draft.' : null;
    return {
      rowNumber: p.rowNumber,
      error: publishError,
      alreadyImported: owner ? toRef(owner) : null,
      possibleDuplicates: similar.slice(0, 3).map(toRef),
    };
  });

  return { results, storageConfigured: getStorage().kind !== 'unconfigured' };
}

// ------------------------------------------------------------------ upload --

export type ImportUploadResult = { alreadyImported: ExistingReportRef; upload: null } | { alreadyImported: null; upload: IssuedUpload };

function parseRow(raw: unknown) {
  const parsed = importRowWithFileSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = toFieldErrors(parsed.error);
    throw new ReportError('validation', describeFieldErrors(errors) || 'This row is not valid.', errors);
  }
  return parsed.data;
}

export async function requestImportUpload(ctx: AuthContext, raw: unknown, options: ReportServiceOptions = {}): Promise<ImportUploadResult> {
  const row = parseRow(raw);
  assertCanImport(ctx, row.status);
  const { pendingKey, finalKey } = importKeysFor(ctx, row);

  const existing = await getDb().report.findUnique({ where: { fileKey: finalKey }, select: refSelect });
  if (existing) {
    return {
      alreadyImported: { ...existing, reportDate: formatDateOnly(existing.reportDate) },
      upload: null,
    };
  }
  const upload = await issueUpload(
    options.storage ?? getStorage(),
    pendingKey,
    row.fileSize,
    { key: `report-import:${ctx.admin.id}`, ...REPORT_IMPORT_RATE_LIMIT },
    options.now,
  );
  return { alreadyImported: null, upload };
}

// ------------------------------------------------------------------ commit --

const commitSchema = importRowWithFileSchema.extend({ uploadKey: uploadKeySchema });

export async function commitImportRow(ctx: AuthContext, raw: unknown, options: ReportServiceOptions = {}): Promise<CreatedReport> {
  const parsed = commitSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = toFieldErrors(parsed.error);
    throw new ReportError('validation', describeFieldErrors(errors) || 'This row is not valid.', errors);
  }
  const row = parsed.data;
  assertCanImport(ctx, row.status);
  if (row.uploadKey !== importKeysFor(ctx, row).pendingKey) {
    throw new ReportError('upload_invalid', 'The uploaded file does not belong to this row. Retry the row.');
  }
  return createReport(
    ctx,
    {
      title: row.title,
      category: row.category,
      reportDate: row.reportDate,
      description: row.description,
      fileName: row.fileName,
      uploadKey: row.uploadKey,
      intent: row.status === 'PUBLISHED' ? 'publish' : 'draft',
    },
    { ...options, auditContext: { via: 'bulk-import', csvRow: row.rowNumber } },
  );
}
