import { describe, expect, it } from 'vitest';
import { IMPORT_TEMPLATE_CSV, importErrorsCsv, parseImportCsv, validateImportRow } from '@/lib/reports/bulk-import';
import { parseCsv, toCsv } from '@/lib/reports/csv';
import { importUploadKey, parsePendingUploadKey } from '@/lib/server/reports/file-key';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and line breaks inside fields, CRLF and a BOM', () => {
    const text = '﻿a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n\r\nlast,,\n';
    expect(parseCsv(text)).toEqual({ rows: [['a', 'b', 'c'], ['x, y', 'say "hi"', 'line1\nline2'], ['last', '', '']], error: null });
  });
  it('reports an unclosed quote', () => {
    expect(parseCsv('a,"b\nc').error).toMatch(/never closed/);
  });
});

describe('toCsv', () => {
  it('quotes every cell and neutralises spreadsheet formulas', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', 'plain, "q"']])).toBe(`"'=HYPERLINK(""x"")","'+1","plain, ""q"""`);
  });
});

describe('parseImportCsv', () => {
  it('reads the template, numbering rows as they appear in the file', () => {
    const { rows, error } = parseImportCsv(IMPORT_TEMPLATE_CSV);
    expect(error).toBeNull();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ rowNumber: 2, title: 'Global Shipping Outlook', category: 'Global', fileName: 'shipping-outlook.pdf', status: 'Published' });
  });
  it('accepts any column order and case; description is optional', () => {
    const { rows } = parseImportCsv('FileName,Status,ReportDate,Category,Title\nr.pdf,draft,2010-01-05,special,Old note');
    expect(rows[0]).toMatchObject({ title: 'Old note', category: 'special', reportDate: '2010-01-05', description: '', fileName: 'r.pdf', status: 'draft' });
  });
  it('names missing required columns', () => {
    expect(parseImportCsv('title,category\nA,Global').error).toMatch(/reportDate, fileName, status/);
  });
  it('refuses an empty file and a header with no rows', () => {
    expect(parseImportCsv('').error).toMatch(/empty/);
    expect(parseImportCsv('title,category,reportDate,fileName,status\n').error).toMatch(/no reports/);
  });
});

describe('validateImportRow', () => {
  const base = { rowNumber: 2, title: 'A report', category: 'Global', reportDate: '2004-02-29', description: '', fileName: 'a.pdf', status: 'Published' };

  it('normalises friendly values', () => {
    const r = validateImportRow({ ...base, category: ' DOMESTIC ', status: 'draft' });
    expect(r.row).toMatchObject({ category: 'DOMESTIC', status: 'DRAFT', reportDate: '2004-02-29', description: null });
  });
  it.each([
    [{ title: '' }, 'title'],
    [{ category: 'Asia' }, 'category'],
    [{ reportDate: '15/06/2025' }, 'reportDate'],
    [{ reportDate: '2025-02-30' }, 'reportDate'],
    [{ reportDate: '1999-12-31' }, 'reportDate'],
    [{ fileName: 'scan.docx' }, 'fileName'],
    [{ fileName: '' }, 'fileName'],
    [{ status: 'Archived' }, 'status'],
  ])('rejects %o', (override, field) => {
    const r = validateImportRow({ ...base, ...override });
    expect(r.errors).toHaveProperty(field);
  });
});

describe('importUploadKey', () => {
  const admin = '11111111-2222-4333-8444-555555555555';
  it('is stable for the same row and different for any other', () => {
    const a = importUploadKey(admin, 'x|2020-01-01|GLOBAL|a.pdf|100');
    expect(importUploadKey(admin, 'x|2020-01-01|GLOBAL|a.pdf|100')).toEqual(a);
    expect(importUploadKey(admin, 'x|2020-01-01|GLOBAL|a.pdf|101').key).not.toBe(a.key);
    expect(importUploadKey('99999999-2222-4333-8444-555555555555', 'x|2020-01-01|GLOBAL|a.pdf|100').key).not.toBe(a.key);
  });
  it('produces a normal pending key bound to the admin', () => {
    const { key, uploadId } = importUploadKey(admin, 'anything');
    expect(parsePendingUploadKey(key)).toEqual({ adminId: admin, uploadId });
  });
});

describe('importErrorsCsv', () => {
  it('lists row, file, title and reason', () => {
    expect(importErrorsCsv([{ rowNumber: 4, fileName: 'a.pdf', title: 'A', reason: 'Missing PDF' }])).toBe(
      '"row","fileName","title","error"\r\n"4","a.pdf","A","Missing PDF"',
    );
  });
});
