import { isCalendarDate, MONTH_NAMES, monthBounds, yearBounds } from './calendar';
import { REPORT_CATEGORIES, REPORT_STATUSES, SEARCH_MAX_LENGTH, type ReportCategoryValue, type ReportStatusValue } from './constants';

// ============================================================================
// Report list filters <-> URL query parameters.
//
// Filters live in the URL so a filtered view can be bookmarked or shared and
// the back button works. Parsing is forgiving: an invalid or unknown value is
// ignored rather than turned into an error page.
//
//   ?category=global&q=iron&date=2026-11-05
//   ?from=2026-10-01&to=2026-10-31
//   ?year=2026&month=11            (month needs a year; a year alone is allowed)
//   &sort=oldest&page=2
//
// Date modes are mutually exclusive; if several are present the most specific
// wins: exact date, then range, then month/year.
// ============================================================================

type Params = Record<string, string | string[] | undefined>;

export type DateFilter =
  | { mode: 'all' }
  | { mode: 'date'; date: string; from: string; to: string }
  | { mode: 'range'; from?: string; to?: string }
  | { mode: 'month'; year: number; month: number; from: string; to: string }
  | { mode: 'year'; year: number; from: string; to: string };

export type ReportSortValue = 'newest' | 'oldest';

export interface PublicReportQuery {
  category?: ReportCategoryValue;
  q?: string;
  dateFilter: DateFilter;
  sort: ReportSortValue;
  page: number;
}

export interface AdminReportQuery extends PublicReportQuery {
  status?: ReportStatusValue;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function parseInt10(value: string | undefined, min: number, max: number): number | undefined {
  if (!value || !/^\d{1,5}$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

export function resolveDateFilter(params: Params): DateFilter {
  const date = first(params.date)?.trim();
  if (date && isCalendarDate(date)) return { mode: 'date', date, from: date, to: date };

  let from = first(params.from)?.trim();
  let to = first(params.to)?.trim();
  from = from && isCalendarDate(from) ? from : undefined;
  to = to && isCalendarDate(to) ? to : undefined;
  if (from || to) {
    if (from && to && from > to) [from, to] = [to, from]; // forgive a reversed range
    return { mode: 'range', ...(from ? { from } : {}), ...(to ? { to } : {}) };
  }

  const year = parseInt10(first(params.year), 2000, 2999);
  if (year) {
    const month = parseInt10(first(params.month), 1, 12);
    if (month) return { mode: 'month', year, month, ...monthBounds(year, month) };
    return { mode: 'year', year, ...yearBounds(year) };
  }
  return { mode: 'all' };
}

/** The inclusive bounds to hand to the query layer. */
export function dateBounds(filter: DateFilter): { from?: string; to?: string } {
  if (filter.mode === 'all') return {};
  return { from: filter.from, to: filter.to };
}

export function parsePublicReportQuery(params: Params): PublicReportQuery {
  const category = first(params.category)?.toUpperCase();
  const q = first(params.q)?.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_LENGTH);
  return {
    category: (REPORT_CATEGORIES as readonly string[]).includes(category ?? '') ? (category as ReportCategoryValue) : undefined,
    q: q || undefined,
    dateFilter: resolveDateFilter(params),
    sort: first(params.sort) === 'oldest' ? 'oldest' : 'newest',
    page: parseInt10(first(params.page), 1, 10000) ?? 1,
  };
}

export function parseAdminReportQuery(params: Params): AdminReportQuery {
  const status = first(params.status)?.toUpperCase();
  return {
    ...parsePublicReportQuery(params),
    status: (REPORT_STATUSES as readonly string[]).includes(status ?? '') ? (status as ReportStatusValue) : undefined,
  };
}

/** Query string for a filter state, omitting defaults. `overrides` change single
 *  values (null removes one); any filter change resets to page 1. */
export function toQueryString(query: Partial<AdminReportQuery>, overrides: Record<string, string | number | null | undefined> = {}): string {
  const out = new URLSearchParams();
  if (query.category) out.set('category', query.category.toLowerCase());
  if ('status' in query && query.status) out.set('status', query.status.toLowerCase());
  if (query.q) out.set('q', query.q);
  const f = query.dateFilter;
  if (f?.mode === 'date') out.set('date', f.date);
  if (f?.mode === 'range') {
    if (f.from) out.set('from', f.from);
    if (f.to) out.set('to', f.to);
  }
  if (f?.mode === 'month') {
    out.set('year', String(f.year));
    out.set('month', String(f.month));
  }
  if (f?.mode === 'year') out.set('year', String(f.year));
  if (query.sort === 'oldest') out.set('sort', 'oldest');
  if (query.page && query.page > 1) out.set('page', String(query.page));

  const resetsPage = Object.keys(overrides).some((k) => k !== 'page');
  if (resetsPage) out.delete('page');
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined || value === '') out.delete(key);
    else out.set(key, String(value));
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}

/** "November 2026", "5 Nov 2026 – 30 Nov 2026" … for result summaries. */
export function describeDateFilter(filter: DateFilter): string | null {
  const short = (ymd: string) => {
    const [y, m, d] = ymd.split('-');
    return `${Number(d)} ${MONTH_NAMES[Number(m) - 1].slice(0, 3)} ${y}`;
  };
  switch (filter.mode) {
    case 'date':
      return short(filter.date);
    case 'range':
      return filter.from && filter.to ? `${short(filter.from)} – ${short(filter.to)}` : filter.from ? `From ${short(filter.from)}` : `Up to ${short(filter.to!)}`;
    case 'month':
      return `${MONTH_NAMES[filter.month - 1]} ${filter.year}`;
    case 'year':
      return String(filter.year);
    default:
      return null;
  }
}
