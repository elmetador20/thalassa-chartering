import 'server-only';
import { randomUUID } from 'node:crypto';

// ============================================================================
// R2 object keys. Built from random UUIDs only — never the title, report date
// or uploaded file name — so keys cannot collide, never carry user input into
// a storage path, and stay accurate when a report's details are edited.
//
//   pending/<admin-id>/<upload-id>.pdf   uploaded by the browser, not yet
//                                        verified; R2 lifecycle deletes these
//                                        after a day if never finalised
//   reports/<upload-id>.pdf              verified, referenced by a report row
//
// The permanent key reuses the upload's id. That makes finalising idempotent:
// submitting the same upload twice targets the same key, and the unique index
// on `file_key` lets only one report claim it.
// ============================================================================

/** Final namespace. Mirrors `reports_file_key_format_chk`. */
export const REPORT_FILE_PREFIX = 'reports/';
export const PENDING_UPLOAD_PREFIX = 'pending/';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PENDING_KEY = new RegExp(`^pending/(${UUID})/(${UUID})\\.pdf$`);

/** A random permanent key (used where no upload id exists, e.g. fixtures). */
export function newReportFileKey(): string {
  return `${REPORT_FILE_PREFIX}${randomUUID()}.pdf`;
}

/** A pending key bound to the admin who requested the upload. */
export function newPendingUploadKey(adminId: string): { key: string; uploadId: string } {
  const uploadId = randomUUID();
  return { key: `${PENDING_UPLOAD_PREFIX}${adminId}/${uploadId}.pdf`, uploadId };
}

export function parsePendingUploadKey(key: string): { adminId: string; uploadId: string } | null {
  const match = PENDING_KEY.exec(key);
  return match ? { adminId: match[1], uploadId: match[2] } : null;
}

/** The permanent key a verified upload is copied to. */
export function reportFileKeyForUpload(uploadId: string): string {
  return `${REPORT_FILE_PREFIX}${uploadId}.pdf`;
}
