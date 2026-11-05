import 'server-only';
import { randomUUID } from 'node:crypto';

/** Final R2 namespace for report PDFs. Mirrors `reports_file_key_format_chk`. */
export const REPORT_FILE_PREFIX = 'reports/';

/**
 * A fresh R2 object key for a report PDF.
 *
 * Built from a random UUID alone — never the title, the report date or the
 * uploaded file name — so keys cannot collide, never carry user input into a
 * storage path, and stay accurate when a report's metadata is edited later.
 * The unique index on `file_key` is the final guarantee; this makes sure it is
 * never actually exercised.
 */
export function newReportFileKey(): string {
  return `${REPORT_FILE_PREFIX}${randomUUID()}.pdf`;
}
