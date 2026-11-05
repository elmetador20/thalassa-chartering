import 'server-only';
import { getDb } from '../db';
import { describeErrorSafely } from '../safe-error';
import { PENDING_UPLOAD_PREFIX, REPORT_FILE_PREFIX } from '../reports/file-key';
import type { ReportStorage } from './types';

// ============================================================================
// Storage ↔ database reconciliation. Read-only unless told otherwise.
//
//   orphaned files     objects under reports/ that no report row references
//                      (e.g. a delete whose file removal failed). LISTED ONLY —
//                      never deleted here; check the audit log, then remove
//                      them by hand if they really are unused.
//   missing files      report rows whose object is gone (needs a new upload)
//   stale uploads      pending/ objects older than the cut-off — uploads
//                      started but never saved. These are temporary by
//                      definition; deleted only with `deleteStaleUploads`.
// ============================================================================

export const STALE_UPLOAD_AGE_MS = 24 * 60 * 60 * 1000;

export interface ReconcileOptions {
  storage: ReportStorage;
  now?: Date;
  /** Default false: report what would be removed, remove nothing. */
  deleteStaleUploads?: boolean;
  staleAfterMs?: number;
}

export interface ReconcileReport {
  dryRun: boolean;
  checkedObjects: number;
  checkedReports: number;
  orphanedFiles: { key: string; size: number; lastModified: string | null }[];
  missingFiles: { reportId: string; title: string; fileKey: string; status: string }[];
  staleUploads: { key: string; size: number; lastModified: string | null }[];
  deletedUploads: number;
  failedDeletes: string[];
}

export async function reconcileStorage(options: ReconcileOptions): Promise<ReconcileReport> {
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - (options.staleAfterMs ?? STALE_UPLOAD_AGE_MS);

  const [stored, pending, reports] = await Promise.all([
    options.storage.list(REPORT_FILE_PREFIX),
    options.storage.list(PENDING_UPLOAD_PREFIX),
    getDb().report.findMany({ select: { id: true, title: true, fileKey: true, status: true } }),
  ]);

  const referenced = new Set(reports.map((r) => r.fileKey));
  const present = new Set(stored.map((o) => o.key));
  const iso = (d: Date | null) => (d ? d.toISOString() : null);

  const report: ReconcileReport = {
    dryRun: !options.deleteStaleUploads,
    checkedObjects: stored.length + pending.length,
    checkedReports: reports.length,
    orphanedFiles: stored.filter((o) => !referenced.has(o.key)).map((o) => ({ key: o.key, size: o.size, lastModified: iso(o.lastModified) })),
    missingFiles: reports.filter((r) => !present.has(r.fileKey)).map((r) => ({ reportId: r.id, title: r.title, fileKey: r.fileKey, status: r.status })),
    // An object without a date is treated as stale only if very old is provable — i.e. never.
    staleUploads: pending
      .filter((o) => o.lastModified && o.lastModified.getTime() < cutoff)
      .map((o) => ({ key: o.key, size: o.size, lastModified: iso(o.lastModified) })),
    deletedUploads: 0,
    failedDeletes: [],
  };

  if (options.deleteStaleUploads) {
    for (const o of report.staleUploads) {
      try {
        await options.storage.delete(o.key);
        report.deletedUploads++;
      } catch (error) {
        report.failedDeletes.push(`${o.key}: ${describeErrorSafely(error)}`);
      }
    }
  }
  return report;
}
