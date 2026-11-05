// ============================================================================
// Report rules shared by the browser, the server and the tests. Every limit
// the product depends on lives here, so changing one is a one-line edit.
// ============================================================================

export const REPORT_CATEGORIES = ['GLOBAL', 'DOMESTIC', 'SPECIAL'] as const;
export type ReportCategoryValue = (typeof REPORT_CATEGORIES)[number];

export const REPORT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ReportStatusValue = (typeof REPORT_STATUSES)[number];

export const CATEGORY_LABELS: Record<ReportCategoryValue, string> = {
  GLOBAL: 'Global',
  DOMESTIC: 'Domestic',
  SPECIAL: 'Special',
};

export const STATUS_LABELS: Record<ReportStatusValue, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

// --- Files --------------------------------------------------------------
export const PDF_MIME_TYPE = 'application/pdf';
export const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB
/** Every real PDF starts with these five bytes. */
export const PDF_MAGIC_BYTES = '%PDF-';

// --- Signed URL lifetimes (seconds) -------------------------------------
/** Time to start the browser → R2 upload. */
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;
/** The in-page viewer makes range requests while someone reads, so it needs
 *  a little longer than a one-off download. */
export const PREVIEW_URL_TTL_SECONDS = 10 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

// --- Fields -------------------------------------------------------------
export const TITLE_MAX_LENGTH = 300; // matches VARCHAR(300)
export const DESCRIPTION_MAX_LENGTH = 2000;
export const FILE_NAME_MAX_LENGTH = 255; // matches VARCHAR(255)
/** Earliest report date accepted (historical back-fill). The latest is
 *  always "today" in India Standard Time. */
export const MIN_REPORT_DATE = '2000-01-01';
export const SEARCH_MAX_LENGTH = 100;

// --- Lists --------------------------------------------------------------
export const PUBLIC_PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 20;

/** "4.2 MB", "820 KB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
