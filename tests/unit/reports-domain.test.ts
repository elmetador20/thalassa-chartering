import { describe, expect, it } from 'vitest';
import { isCalendarDate, monthBounds, todayInIndia } from '@/lib/reports/calendar';
import { MAX_PDF_BYTES } from '@/lib/reports/constants';
import { dateBounds, parseAdminReportQuery, parsePublicReportQuery, resolveDateFilter, toQueryString } from '@/lib/reports/filters';
import { contentDisposition, safePdfFileName } from '@/lib/server/reports/content-disposition';
import { newPendingUploadKey, parsePendingUploadKey, reportFileKeyForUpload } from '@/lib/server/reports/file-key';
import { newReportSlug, slugifyTitle } from '@/lib/server/reports/slug';
import { checkPdfFile, createReportSchema, reportDateSchema, reportDetailsSchema, uploadRequestSchema } from '@/lib/validation/reports';
import { toFieldErrors } from '@/lib/validation/auth';

const ADMIN_ID = '11111111-2222-4333-8444-555555555555';
const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? null : r.error!.issues[0].message);

describe('India Standard Time "today"', () => {
  it('rolls over at midnight IST, not midnight UTC', () => {
    expect(todayInIndia(new Date('2026-11-05T18:29:59Z'))).toBe('2026-11-05'); // 23:59:59 IST
    expect(todayInIndia(new Date('2026-11-05T18:30:00Z'))).toBe('2026-11-06'); // 00:00:00 IST
  });

  it('handles year boundaries', () => {
    expect(todayInIndia(new Date('2026-12-31T19:00:00Z'))).toBe('2027-01-01');
  });
});

describe('calendar dates', () => {
  it('accepts real dates only', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true);
    for (const bad of ['2026-02-29', '2026-13-01', '2026-04-31', '05/11/2026', '2026-1-5', '', null]) expect(isCalendarDate(bad)).toBe(false);
  });

  it('knows month lengths, including leap years', () => {
    expect(monthBounds(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthBounds(2026, 11)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
});

describe('report date validation', () => {
  it('accepts historical dates back to 1 January 2000, and today', () => {
    expect(reportDateSchema.safeParse('2000-01-01').success).toBe(true);
    expect(reportDateSchema.safeParse(todayInIndia()).success).toBe(true);
  });

  it.each([
    ['1999-12-31', 'Report dates start on 1 January 2000.'],
    ['2026-02-30', 'Enter a valid date.'],
    ['', 'Report date is required.'],
  ])('%s → %s', (value, message) => {
    expect(firstError(reportDateSchema.safeParse(value))).toBe(message);
  });

  it('rejects future dates (tomorrow in IST)', () => {
    const tomorrow = new Date(Date.parse(`${todayInIndia()}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    expect(firstError(reportDateSchema.safeParse(tomorrow))).toBe('The report date cannot be in the future.');
  });
});

describe('report details', () => {
  const valid = { title: '  Iron ore   weekly outlook ', category: 'GLOBAL', reportDate: '2026-11-05', description: '  ' };

  it('normalises whitespace and turns an empty description into null', () => {
    expect(reportDetailsSchema.parse(valid)).toEqual({ title: 'Iron ore weekly outlook', category: 'GLOBAL', reportDate: '2026-11-05', description: null });
  });

  it('gives field-specific errors', () => {
    const errors = toFieldErrors(reportDetailsSchema.safeParse({ title: '', category: 'FOO', reportDate: 'x', description: 'd'.repeat(2001) }).error!);
    expect(errors.title?.[0]).toBe('Title is required.');
    expect(errors.category?.[0]).toBe('Choose a category.');
    expect(errors.reportDate?.[0]).toBe('Enter a valid date.');
    expect(errors.description?.[0]).toMatch(/2000 characters or fewer/);
  });

  it('rejects control characters in titles and over-long titles', () => {
    expect(reportDetailsSchema.safeParse({ ...valid, title: 'bad\u0000title' }).success).toBe(false);
    expect(reportDetailsSchema.safeParse({ ...valid, title: 'x'.repeat(301) }).success).toBe(false);
  });
});

describe('upload request validation', () => {
  const ok = { fileName: 'Weekly Report.pdf', contentType: 'application/pdf', size: 1024 };

  it('accepts a PDF', () => {
    expect(uploadRequestSchema.safeParse(ok).success).toBe(true);
    expect(uploadRequestSchema.safeParse({ ...ok, fileName: 'REPORT.PDF' }).success).toBe(true);
  });

  it.each([
    [{ contentType: 'text/html' }, 'Only PDF files can be uploaded.'],
    [{ contentType: 'application/x-msdownload' }, 'Only PDF files can be uploaded.'],
    [{ fileName: 'report.exe' }, 'Only .pdf files can be uploaded.'],
    [{ fileName: 'report.pdf.exe' }, 'Only .pdf files can be uploaded.'],
    [{ fileName: '../../etc/passwd.pdf' }, 'The file name is not valid.'],
    [{ fileName: 'C:\\evil\\x.pdf' }, 'The file name is not valid.'],
    [{ size: 0 }, 'The file is empty.'],
    [{ size: MAX_PDF_BYTES + 1 }, 'PDFs can be at most 50 MB.'],
    [{ size: 1.5 }, 'The file size is not valid.'],
  ])('%o is refused', (override, message) => {
    expect(firstError(uploadRequestSchema.safeParse({ ...ok, ...override }))).toBe(message);
  });

  it('accepts exactly 50 MB', () => {
    expect(uploadRequestSchema.safeParse({ ...ok, size: MAX_PDF_BYTES }).success).toBe(true);
  });

  it('browser pre-check: extension decides when the type is blank', () => {
    expect(checkPdfFile({ name: 'a.pdf', type: '', size: 10 })).toBeNull();
    expect(checkPdfFile({ name: 'a.pdf', type: 'image/png', size: 10 })).toBe('Only PDF files can be uploaded.');
    expect(checkPdfFile({ name: 'a.docx', type: '', size: 10 })).toBe('Only .pdf files can be uploaded.');
    expect(checkPdfFile({ name: 'a.pdf', type: 'application/pdf', size: MAX_PDF_BYTES + 1 })).toBe('PDFs can be at most 50 MB.');
  });

  it('create schema requires a server-issued pending key', () => {
    const base = { title: 'T', category: 'GLOBAL', reportDate: '2026-11-05', description: null, intent: 'draft', fileName: 'a.pdf' };
    expect(createReportSchema.safeParse({ ...base, uploadKey: newPendingUploadKey(ADMIN_ID).key }).success).toBe(true);
    for (const key of ['reports/x.pdf', 'pending/../reports/a.pdf', '', 'pending/abc/def.pdf']) {
      expect(createReportSchema.safeParse({ ...base, uploadKey: key }).success).toBe(false);
    }
  });
});

describe('storage keys', () => {
  it('pending keys are bound to the requesting admin and map to one permanent key', () => {
    const { key, uploadId } = newPendingUploadKey(ADMIN_ID);
    expect(key).toBe(`pending/${ADMIN_ID}/${uploadId}.pdf`);
    expect(parsePendingUploadKey(key)).toEqual({ adminId: ADMIN_ID, uploadId });
    expect(reportFileKeyForUpload(uploadId)).toBe(`reports/${uploadId}.pdf`);
    expect(parsePendingUploadKey(`pending/${ADMIN_ID}/../x.pdf`)).toBeNull();
  });
});

describe('slugs', () => {
  it('are readable, URL-safe and unique for identical title + date', () => {
    const a = newReportSlug('Iron Ore — Weekly Outlook (Q4)', '2026-11-05');
    const b = newReportSlug('Iron Ore — Weekly Outlook (Q4)', '2026-11-05');
    expect(a).toMatch(/^iron-ore-weekly-outlook-q4-2026-11-05-[a-z0-9]{6}$/);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/); // reports_slug_format_chk
  });

  it('handle accents, symbols-only titles and very long titles', () => {
    expect(slugifyTitle('Café Ünïcode Résumé')).toBe('cafe-unicode-resume');
    expect(newReportSlug('—', '2026-11-05')).toMatch(/^report-2026-11-05-[a-z0-9]{6}$/);
    expect(newReportSlug('word '.repeat(60), '2026-11-05').length).toBeLessThanOrEqual(160);
  });
});

describe('download headers', () => {
  it('strip paths and quotes, keep the real name in UTF-8', () => {
    expect(safePdfFileName('../../secret/"report".pdf')).toBe('report.pdf');
    const header = contentDisposition('attachment', "Rapport d'été.pdf");
    expect(header).toMatch(/^attachment; filename="Rapport d'ete.pdf"; filename\*=UTF-8''Rapport%20d%27%C3%A9t%C3%A9\.pdf$/);
    expect(contentDisposition('inline', 'x\r\nSet-Cookie: a=b.pdf')).not.toMatch(/[\r\n]/);
  });
});

describe('URL filters', () => {
  it('exact date wins over range and month/year', () => {
    expect(resolveDateFilter({ date: '2026-11-05', from: '2026-01-01', year: '2025' })).toMatchObject({ mode: 'date', from: '2026-11-05', to: '2026-11-05' });
  });

  it('range, with a reversed range forgiven', () => {
    expect(resolveDateFilter({ from: '2026-11-30', to: '2026-11-01' })).toEqual({ mode: 'range', from: '2026-11-01', to: '2026-11-30' });
    expect(resolveDateFilter({ to: '2026-11-01' })).toEqual({ mode: 'range', to: '2026-11-01' });
  });

  it('month + year, or year alone; month without year is ignored', () => {
    expect(resolveDateFilter({ year: '2026', month: '2' })).toMatchObject({ mode: 'month', from: '2026-02-01', to: '2026-02-28' });
    expect(resolveDateFilter({ year: '2026' })).toMatchObject({ mode: 'year', from: '2026-01-01', to: '2026-12-31' });
    expect(resolveDateFilter({ month: '2' })).toEqual({ mode: 'all' });
  });

  it('ignores garbage instead of failing', () => {
    const q = parsePublicReportQuery({ category: 'secret', date: 'nope', sort: 'random', page: '-4', year: '1500', q: '   ' });
    expect(q).toEqual({ category: undefined, q: undefined, dateFilter: { mode: 'all' }, sort: 'newest', page: 1 });
    expect(parseAdminReportQuery({ status: 'deleted' }).status).toBeUndefined();
  });

  it('round-trips through the query string, dropping defaults and resetting the page on change', () => {
    const q = parseAdminReportQuery({ category: 'global', status: 'draft', q: 'iron', year: '2026', month: '11', sort: 'oldest', page: '3' });
    expect(toQueryString(q)).toBe('?category=global&status=draft&q=iron&year=2026&month=11&sort=oldest&page=3');
    expect(toQueryString(q, { category: null })).toBe('?status=draft&q=iron&year=2026&month=11&sort=oldest');
    expect(toQueryString(q, { page: 4 })).toContain('page=4');
    expect(dateBounds(q.dateFilter)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
});
