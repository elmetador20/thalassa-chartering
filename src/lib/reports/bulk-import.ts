import { z } from 'zod';
import { toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import { pdfFileNameSchema, reportDetailsSchema } from '@/lib/validation/reports';
import { CATEGORY_LABELS, MAX_PDF_BYTES, REPORT_CATEGORIES, type ReportCategoryValue } from './constants';
import { parseCsv, toCsv } from './csv';

// ============================================================================
// Bulk import of historical reports: one CSV + many PDFs.
//
// Shared by the browser (preview, instant feedback) and the server (which
// re-validates every row before anything is stored). PDFs are matched to rows
// by the exact `fileName` column — never by upload order.
// ============================================================================

export const IMPORT_COLUMNS = ['title', 'category', 'reportDate', 'description', 'fileName', 'status'] as const;
export const REQUIRED_IMPORT_COLUMNS = ['title', 'category', 'reportDate', 'fileName', 'status'] as const;

/** One import is at most this many rows; split larger collections. */
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_CSV_BYTES = 2 * 1024 * 1024;
/** Rows uploaded at the same time, unless REPORT_IMPORT_BATCH_SIZE says otherwise. */
export const DEFAULT_IMPORT_BATCH_SIZE = 3;
export const MAX_IMPORT_BATCH_SIZE = 10;

export const IMPORT_TEMPLATE_CSV = [
  'title,category,reportDate,description,fileName,status',
  'Global Shipping Outlook,Global,2025-06-15,Annual shipping analysis,shipping-outlook.pdf,Published',
  'India Trade Report,Domestic,2025-07-10,Indian trade overview,india-trade.pdf,Draft',
  'Special Market Analysis,Special,2025-08-20,Special industry research,market-analysis.pdf,Published',
].join('\r\n');

export type ImportStatus = 'DRAFT' | 'PUBLISHED';

/** A row as written in the CSV (strings only). `rowNumber` is the line in the
 *  file, counting the header as row 1, so admins can find it in Excel. */
export interface RawImportRow {
  rowNumber: number;
  title: string;
  category: string;
  reportDate: string;
  description: string;
  fileName: string;
  status: string;
}

const CATEGORY_BY_NAME: Record<string, ReportCategoryValue> = Object.fromEntries(
  REPORT_CATEGORIES.flatMap((c) => [
    [c.toLowerCase(), c],
    [CATEGORY_LABELS[c].toLowerCase(), c],
  ]),
);

const STATUS_BY_NAME: Record<string, ImportStatus> = { draft: 'DRAFT', published: 'PUBLISHED', publish: 'PUBLISHED' };

/** Normalises the CSV's human-friendly values ("Global", "Published"). */
const importStatusSchema = z
  .string({ error: 'Status is required.' })
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => v !== '', { error: 'Status is required.' })
  .refine((v) => v in STATUS_BY_NAME, { error: 'Status must be Draft or Published.' })
  .transform((v) => STATUS_BY_NAME[v]);

const importCategorySchema = z
  .string({ error: 'Category is required.' })
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => v !== '', { error: 'Category is required.' })
  .refine((v) => v in CATEGORY_BY_NAME, { error: 'Category must be Global, Domestic or Special.' })
  .transform((v) => CATEGORY_BY_NAME[v]);

/** One validated row — what the server accepts. */
export const importRowSchema = reportDetailsSchema.extend({
  rowNumber: z.number().int().min(2).max(MAX_IMPORT_ROWS + 1),
  category: importCategorySchema,
  status: importStatusSchema,
  fileName: pdfFileNameSchema,
});
export type ImportRow = z.infer<typeof importRowSchema>;

/** The row plus the PDF's size: identifies "this report" for idempotency. */
export const importRowWithFileSchema = importRowSchema.extend({
  fileSize: z.number().int().positive({ error: 'The PDF is empty.' }).max(MAX_PDF_BYTES, { error: 'PDFs can be at most 50 MB.' }),
});
export type ImportRowWithFile = z.infer<typeof importRowWithFileSchema>;

export function validateImportRow(raw: RawImportRow): { row: ImportRow; errors: null } | { row: null; errors: FieldErrors } {
  const parsed = importRowSchema.safeParse(raw);
  return parsed.success ? { row: parsed.data, errors: null } : { row: null, errors: toFieldErrors(parsed.error) };
}

/** First error per field, as one readable line ("Category: …; Report date: …"). */
export function describeFieldErrors(errors: FieldErrors): string {
  const LABELS: Record<string, string> = {
    title: 'Title',
    category: 'Category',
    reportDate: 'Report date',
    description: 'Description',
    fileName: 'File name',
    status: 'Status',
    fileSize: 'PDF',
  };
  return Object.entries(errors)
    .filter(([, list]) => list && list.length)
    .map(([field, list]) => `${LABELS[field] ?? field}: ${list![0]}`)
    .join('; ');
}

export interface ParsedImportCsv {
  rows: RawImportRow[];
  /** Problems with the file as a whole (missing columns, too many rows…). */
  error: string | null;
}

/** Reads the CSV into rows keyed by column name (header order and case are free). */
export function parseImportCsv(text: string): ParsedImportCsv {
  const { rows, error } = parseCsv(text);
  if (error) return { rows: [], error };
  if (rows.length === 0) return { rows: [], error: 'The CSV is empty.' };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const index: Partial<Record<(typeof IMPORT_COLUMNS)[number], number>> = {};
  for (const col of IMPORT_COLUMNS) {
    const at = header.indexOf(col.toLowerCase());
    if (at >= 0) index[col] = at;
  }
  const missing = REQUIRED_IMPORT_COLUMNS.filter((c) => index[c] === undefined);
  if (missing.length) {
    return { rows: [], error: `The CSV is missing the column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template to see the expected format.` };
  }
  const body = rows.slice(1);
  if (body.length === 0) return { rows: [], error: 'The CSV has a header but no reports.' };
  if (body.length > MAX_IMPORT_ROWS) {
    return { rows: [], error: `The CSV has ${body.length} reports; one import can have at most ${MAX_IMPORT_ROWS}. Split it into several files.` };
  }

  const cell = (r: string[], col: (typeof IMPORT_COLUMNS)[number]) => {
    const at = index[col];
    return at === undefined ? '' : (r[at] ?? '').trim();
  };
  return {
    rows: body.map((r, i) => ({
      rowNumber: i + 2,
      title: cell(r, 'title'),
      category: cell(r, 'category'),
      reportDate: cell(r, 'reportDate'),
      description: cell(r, 'description'),
      fileName: cell(r, 'fileName'),
      status: cell(r, 'status'),
    })),
    error: null,
  };
}

/** Same title (ignoring case and spacing) on the same report date. */
export function duplicateFingerprint(title: string, reportDate: string): string {
  return `${title.replace(/\s+/g, ' ').trim().toLowerCase()}|${reportDate}`;
}

/** An existing report, as the import preview refers to it. */
export interface ExistingReportRef {
  id: string;
  title: string;
  slug: string;
  category: string;
  reportDate: string;
  status: string;
}

/** The server's verdict on one row during the preview. */
export interface ImportCheckResult {
  rowNumber: number;
  /** Server-side validation problem, one line; null when the row is valid. */
  error: string | null;
  /** This exact row was imported before (same admin, details and file). */
  alreadyImported: ExistingReportRef | null;
  /** Existing reports with the same title on the same date. */
  possibleDuplicates: ExistingReportRef[];
}

export interface ImportErrorLine {
  rowNumber: number | null;
  fileName: string;
  title: string;
  reason: string;
}

export function importErrorsCsv(lines: ImportErrorLine[]): string {
  return toCsv([['row', 'fileName', 'title', 'error'], ...lines.map((l) => [l.rowNumber ?? '', l.fileName, l.title, l.reason])]);
}
