import { z } from 'zod';
import { isCalendarDate, todayInIndia } from '@/lib/reports/calendar';
import {
  DESCRIPTION_MAX_LENGTH,
  FILE_NAME_MAX_LENGTH,
  MAX_PDF_BYTES,
  MIN_REPORT_DATE,
  PDF_MIME_TYPE,
  REPORT_CATEGORIES,
  TITLE_MAX_LENGTH,
} from '@/lib/reports/constants';

// ============================================================================
// Validation for every report input. Shared by the browser (instant feedback)
// and the server (enforcement) — the server always re-parses.
// ============================================================================

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export const reportTitleSchema = z
  .string({ error: 'Title is required.' })
  .transform((value) => value.replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(1, { error: 'Title is required.' })
      .max(TITLE_MAX_LENGTH, { error: `Keep the title to ${TITLE_MAX_LENGTH} characters or fewer.` })
      .refine((value) => !CONTROL_CHARS.test(value), { error: 'The title contains characters that are not allowed.' }),
  );

export const reportCategorySchema = z.enum(REPORT_CATEGORIES, { error: 'Choose a category.' });

/**
 * The business date the report covers: a real calendar date from
 * 1 January 2000 to today in India. "Today" is evaluated at parse time, so a
 * long-running server never freezes it.
 */
export const reportDateSchema = z
  .string({ error: 'Report date is required.' })
  .trim()
  .superRefine((value, ctx) => {
    if (!value) ctx.addIssue({ code: 'custom', message: 'Report date is required.' });
    else if (!isCalendarDate(value)) ctx.addIssue({ code: 'custom', message: 'Enter a valid date.' });
    else if (value < MIN_REPORT_DATE) ctx.addIssue({ code: 'custom', message: 'Report dates start on 1 January 2000.' });
    else if (value > todayInIndia()) ctx.addIssue({ code: 'custom', message: 'The report date cannot be in the future.' });
  });

export const reportDescriptionSchema = z
  .string()
  .nullish()
  .transform((value) => (value ?? '').trim())
  .pipe(z.string().max(DESCRIPTION_MAX_LENGTH, { error: `Keep the description to ${DESCRIPTION_MAX_LENGTH} characters or fewer.` }))
  .transform((value) => (value ? value : null));

/** The editable information about a report — shared by create and edit. */
export const reportDetailsSchema = z.object({
  title: reportTitleSchema,
  category: reportCategorySchema,
  reportDate: reportDateSchema,
  description: reportDescriptionSchema,
});
export type ReportDetailsInput = z.infer<typeof reportDetailsSchema>;

// --------------------------------------------------------------------- files --

/** Display/download name of an uploaded PDF: a plain file name ending .pdf. */
export const pdfFileNameSchema = z
  .string({ error: 'Choose a PDF file.' })
  .trim()
  .min(1, { error: 'Choose a PDF file.' })
  .max(FILE_NAME_MAX_LENGTH, { error: `The file name must be ${FILE_NAME_MAX_LENGTH} characters or fewer.` })
  .refine((name) => !/[\\/]/.test(name) && !CONTROL_CHARS.test(name), { error: 'The file name is not valid.' })
  .refine((name) => /\.pdf$/i.test(name), { error: 'Only .pdf files can be uploaded.' });

/** What the browser declares before an upload. The server checks the real
 *  bytes afterwards — this is only the first gate. */
export const uploadRequestSchema = z.object({
  fileName: pdfFileNameSchema,
  contentType: z
    .string({ error: 'Only PDF files can be uploaded.' })
    .refine((type) => type.trim().toLowerCase() === PDF_MIME_TYPE, { error: 'Only PDF files can be uploaded.' })
    .transform(() => PDF_MIME_TYPE),
  size: z
    .number({ error: 'The file size is missing.' })
    .int({ error: 'The file size is not valid.' })
    .positive({ error: 'The file is empty.' })
    .max(MAX_PDF_BYTES, { error: 'PDFs can be at most 50 MB.' }),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/** A pending upload key as issued by the server. Ownership is checked by the
 *  service, which knows who is asking. */
export const uploadKeySchema = z
  .string({ error: 'Upload the PDF first.' })
  .regex(/^pending\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/, { error: 'Upload the PDF first.' });

export const createReportSchema = reportDetailsSchema.extend({
  intent: z.enum(['draft', 'publish'], { error: 'Choose Save as draft or Publish.' }),
  uploadKey: uploadKeySchema,
  fileName: pdfFileNameSchema,
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const replaceFileSchema = z.object({
  uploadKey: uploadKeySchema,
  fileName: pdfFileNameSchema,
});

export const reportIdSchema = z.uuid({ error: 'Unknown report.' });

/**
 * Browser-side check before requesting an upload. Some systems report an empty
 * type for PDFs; the extension then decides, and the server still verifies the
 * file's first bytes after upload.
 */
export function checkPdfFile(file: { name: string; type: string; size: number }): string | null {
  if (!/\.pdf$/i.test(file.name)) return 'Only .pdf files can be uploaded.';
  if (file.type && file.type.toLowerCase() !== PDF_MIME_TYPE) return 'Only PDF files can be uploaded.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_PDF_BYTES) return 'PDFs can be at most 50 MB.';
  return null;
}
