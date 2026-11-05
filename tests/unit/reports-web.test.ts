import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { htmlErrorPage, isSameOrigin, readJsonBody } from '@/lib/server/http';
import { resolveSiteHref } from '@/lib/site-links';
import { precheckPdf } from '@/lib/reports/upload-client';
import { MAX_PDF_BYTES } from '@/lib/reports/constants';

// The browser-facing helpers of the reports system: the upload pre-check,
// route-aware site links, and the HTTP guards used by the API routes.

const pdf = (name = 'report.pdf', type = 'application/pdf', body: BlobPart = '%PDF-1.7 test') => new File([body], name, { type });

describe('precheckPdf (browser, before anything is sent)', () => {
  it('accepts a real PDF, including one the OS reports with no type', async () => {
    expect(await precheckPdf(pdf())).toBeNull();
    expect(await precheckPdf(pdf('Report.PDF', ''))).toBeNull();
  });

  it.each([
    [pdf('report.docx'), 'Only .pdf files can be uploaded.'],
    [pdf('report.pdf', 'text/html'), 'Only PDF files can be uploaded.'],
    [pdf('report.pdf', 'application/pdf', ''), 'The file is empty.'],
    [pdf('report.pdf', 'application/pdf', '<html>not a pdf</html>'), 'This file is not a valid PDF.'],
  ])('refuses %s', async (file, message) => {
    expect(await precheckPdf(file)).toBe(message);
  });

  it('refuses a file over 50 MB without reading it', async () => {
    const big = pdf();
    Object.defineProperty(big, 'size', { value: MAX_PDF_BYTES + 1 });
    expect(await precheckPdf(big)).toBe('PDFs can be at most 50 MB.');
  });
});

describe('resolveSiteHref', () => {
  it('keeps in-page anchors on the homepage', () => {
    expect(resolveSiteHref('#about', true)).toBe('#about');
  });
  it('points anchors back to the homepage from any other page', () => {
    expect(resolveSiteHref('#about', false)).toBe('/#about');
    expect(resolveSiteHref('#home', false)).toBe('/');
  });
  it('leaves route links alone', () => {
    expect(resolveSiteHref('/reports', false)).toBe('/reports');
    expect(resolveSiteHref('/reports', true)).toBe('/reports');
  });
});

describe('isSameOrigin (CSRF guard for the upload endpoint)', () => {
  const req = (headers: Record<string, string>) => new NextRequest('http://incworx.in/api/admin/report-uploads', { method: 'POST', headers });

  it('accepts the site’s own origin, also behind a proxy', () => {
    expect(isSameOrigin(req({ host: 'incworx.in', origin: 'https://incworx.in' }))).toBe(true);
    expect(isSameOrigin(req({ host: 'internal:3000', 'x-forwarded-host': 'incworx.in', origin: 'https://incworx.in' }))).toBe(true);
  });

  it('refuses other origins, look-alikes and garbage', () => {
    expect(isSameOrigin(req({ host: 'incworx.in', origin: 'https://evil.example' }))).toBe(false);
    expect(isSameOrigin(req({ host: 'incworx.in', origin: 'https://incworx.in.evil.example' }))).toBe(false);
    expect(isSameOrigin(req({ host: 'incworx.in', origin: 'null' }))).toBe(false);
  });

  it('without an Origin, only a same-origin Fetch Metadata header is accepted', () => {
    expect(isSameOrigin(req({ host: 'incworx.in', 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOrigin(req({ host: 'incworx.in', 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isSameOrigin(req({ host: 'incworx.in' }))).toBe(false);
  });
});

describe('readJsonBody', () => {
  const post = (body: string, type = 'application/json') =>
    new NextRequest('http://incworx.in/x', { method: 'POST', headers: { 'content-type': type }, body });

  it('parses small JSON bodies', async () => {
    expect(await readJsonBody(post('{"a":1}'))).toEqual({ a: 1 });
  });
  it('rejects other content types, malformed JSON and oversized bodies', async () => {
    expect(await readJsonBody(post('{"a":1}', 'text/plain'))).toBeNull();
    expect(await readJsonBody(post('{nope'))).toBeNull();
    expect(await readJsonBody(post(JSON.stringify({ a: 'x'.repeat(5000) })))).toBeNull();
  });
});

describe('htmlErrorPage', () => {
  it('escapes everything it prints and is never cached', async () => {
    const res = htmlErrorPage(404, '<script>x</script>', 'a "quoted" & <b>', { href: '/reports"><script>', label: 'Back' });
    const html = await res.text();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&#60;script&#62;');
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(res.status).toBe(404);
  });
});
