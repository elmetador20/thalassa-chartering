import 'server-only';
import type { FieldErrors } from '@/lib/validation/auth';

/** Every expected way a report operation can be refused. */
export type ReportErrorCode =
  | 'validation'
  | 'not_found'
  | 'invalid_transition'
  | 'conflict'
  | 'confirmation'
  | 'upload_invalid'
  | 'upload_missing'
  | 'rate_limited'
  | 'storage_unavailable'
  | 'storage_error'
  | 'save_failed';

/** An expected, user-facing refusal. The message is always safe to show. */
export class ReportError extends Error {
  constructor(
    readonly code: ReportErrorCode,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = 'ReportError';
  }
}

/** HTTP status for each code, used by the API routes. */
export const REPORT_ERROR_STATUS: Record<ReportErrorCode, number> = {
  validation: 400,
  upload_invalid: 400,
  confirmation: 400,
  not_found: 404,
  upload_missing: 404,
  invalid_transition: 409,
  conflict: 409,
  rate_limited: 429,
  storage_error: 502,
  storage_unavailable: 503,
  save_failed: 500,
};

export const STORAGE_UNAVAILABLE_MESSAGE =
  'PDF storage is not connected yet, so files cannot be uploaded, previewed or downloaded. Everything else works; files will be available once storage is configured.';
