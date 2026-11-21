// ============================================================================
// Date-only values.
//
// `reports.report_date` is a Postgres DATE: a calendar day with no time and no
// time zone. Prisma hands it over as a JS Date at 00:00:00 UTC, and that is
// the only shape a report date may take inside the data layer.
//
// Anything built or read in local time shifts the day by the machine's
// offset. In India (UTC+5:30), `new Date(2026, 10, 5)` is 4 Nov 18:30 UTC and
// would be stored as 4 Nov. So exactly two representations are allowed:
//
//   'YYYY-MM-DD' strings  — every boundary: forms, URLs, JSON, component props
//   UTC-midnight Dates    — inside the data layer only
//
// These two functions are the only conversions between them.
// ============================================================================

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 'YYYY-MM-DD' → UTC-midnight Date, or null if the value is not a real
 * calendar date. `Date.UTC` silently rolls impossible dates over
 * (2026-02-30 becomes 2 March), so the components are checked on the way back.
 */
export function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  const roundTrips =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return roundTrips ? date : null;
}

/** UTC-midnight Date (as Prisma returns a DATE column) → 'YYYY-MM-DD'. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
