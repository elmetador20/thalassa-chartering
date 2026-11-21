// Result of a report server action, shared by the actions and the forms that
// call them. `code` lets the UI react to specific refusals (e.g. ask for a
// fresh upload when the previous one has expired).

import type { FieldErrors } from '@/lib/validation/auth';

export type ReportActionResult<T = null> =
  | { ok: true; message: string; data: T; warnings: string[] }
  | { ok: false; code: string; message: string; fieldErrors?: FieldErrors };

export interface CreatedReportData {
  id: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  duplicate: boolean;
}
