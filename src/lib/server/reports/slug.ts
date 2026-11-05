import 'server-only';
import { randomBytes } from 'node:crypto';

// Public URL segment for a report: readable words from the title, the report
// date, and a short random suffix — so two reports with the same title on the
// same date still get distinct, stable URLs. Generated once at creation and
// never changed by later edits, so shared links keep working.

const MAX_TITLE_PART = 80;
const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function slugifyTitle(title: string): string {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents: "Café" → "Cafe"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (words.length <= MAX_TITLE_PART) return words;
  const cut = words.slice(0, MAX_TITLE_PART);
  return cut.includes('-') ? cut.slice(0, cut.lastIndexOf('-')) : cut; // end on a word boundary
}

export function randomSlugSuffix(length = 6): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length]).join('');
}

/** e.g. "iron-ore-weekly-outlook-2026-11-05-k3x9q2". Satisfies `reports_slug_format_chk`. */
export function newReportSlug(title: string, reportDate: string): string {
  const base = slugifyTitle(title) || 'report';
  return `${base}-${reportDate}-${randomSlugSuffix()}`;
}
