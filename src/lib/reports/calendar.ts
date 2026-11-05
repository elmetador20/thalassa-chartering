// ============================================================================
// Calendar dates ('YYYY-MM-DD') — no times, no time zones. Safe in the browser
// and on the server. Report dates are business dates, so "today" means today
// in India (UTC+5:30, no daylight saving), wherever the code runs.
// ============================================================================

const IST_OFFSET_MS = 330 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Today's date in India Standard Time, e.g. '2026-11-05'. */
export function todayInIndia(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** True for a real calendar date in 'YYYY-MM-DD' form (rejects 2026-02-30). */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** First and last day of a month. */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${pad(year, 4)}-${pad(month)}-01`, to: `${pad(year, 4)}-${pad(month)}-${pad(last)}` };
}

export function yearBounds(year: number): { from: string; to: string } {
  return { from: `${pad(year, 4)}-01-01`, to: `${pad(year, 4)}-12-31` };
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
