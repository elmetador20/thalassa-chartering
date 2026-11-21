import 'server-only';

/** A download name safe to show and to put in a header: no path, no control
 *  characters, always ending in .pdf. */
export function safePdfFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').replace(/\s+/g, ' ').trim();
  const withExt = /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned || 'report'}.pdf`;
  return withExt.length > 200 ? `${withExt.slice(0, 196)}.pdf` : withExt;
}

/**
 * `Content-Disposition` for a PDF (RFC 6266): an ASCII fallback for old
 * clients plus the exact UTF-8 name (RFC 5987), so "Rapport d'été.pdf" survives.
 */
export function contentDisposition(disposition: 'inline' | 'attachment', fileName: string): string {
  const safe = safePdfFileName(fileName);
  const ascii =
    safe
      .normalize('NFKD')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/[\\;]/g, '')
      .trim() || 'report.pdf';
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
