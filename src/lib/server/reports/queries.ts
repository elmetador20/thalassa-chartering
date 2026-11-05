import 'server-only';
import type { Prisma, ReportCategory, ReportStatus } from '@/generated/prisma/client';
import { getDb } from '../db';
import { formatDateOnly, parseDateOnly } from './dates';

// ============================================================================
// Report queries: filtering, sorting by report date, pagination.
// ============================================================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** 'newest' = latest report date first. */
export type ReportSort = 'newest' | 'oldest';

export interface ListReportsParams {
  status?: ReportStatus | ReportStatus[];
  category?: ReportCategory;
  /** Inclusive lower bound, 'YYYY-MM-DD'. Invalid values are ignored. */
  from?: string;
  /** Inclusive upper bound, 'YYYY-MM-DD'. Invalid values are ignored. */
  to?: string;
  /** Case-insensitive match anywhere in the title. */
  query?: string;
  /** 1-based. */
  page?: number;
  pageSize?: number;
  sort?: ReportSort;
}

/**
 * What leaves the data layer: plain and serialisable, so it can be passed
 * straight from a server component to a client component. Dates are strings,
 * the R2 key is not exposed, and nothing from the admin record beyond a name.
 */
export interface ReportListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: ReportCategory;
  status: ReportStatus;
  /** 'YYYY-MM-DD' */
  reportDate: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** ISO 8601 */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

const listSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  category: true,
  status: true,
  reportDate: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ReportSelect;

type ListRow = Prisma.ReportGetPayload<{ select: typeof listSelect }>;

function toListItem(row: ListRow): ReportListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    status: row.status,
    reportDate: formatDateOnly(row.reportDate),
    fileName: row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy,
  };
}

/** Clamps page and page size to sane values and derives OFFSET / LIMIT. */
export function normalisePagination(page?: number, pageSize?: number) {
  const size =
    Number.isInteger(pageSize) && (pageSize as number) > 0
      ? Math.min(pageSize as number, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const current = Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1;
  return { page: current, pageSize: size, skip: (current - 1) * size, take: size };
}

/**
 * Report date first, then upload time, then id.
 *
 * Report date alone is not unique — several reports share a day — and OFFSET
 * pagination over a non-unique ordering can repeat or skip rows between pages.
 * Ending on the primary key makes the order total, so every row appears on
 * exactly one page.
 */
function orderFor(sort: ReportSort): Prisma.ReportOrderByWithRelationInput[] {
  const dir = sort === 'oldest' ? 'asc' : 'desc';
  return [{ reportDate: dir }, { createdAt: dir }, { id: dir }];
}

export function buildReportWhere(params: ListReportsParams): Prisma.ReportWhereInput {
  const where: Prisma.ReportWhereInput = {};

  if (params.status) {
    where.status = Array.isArray(params.status) ? { in: params.status } : params.status;
  }
  if (params.category) where.category = params.category;

  const from = params.from ? parseDateOnly(params.from) : null;
  const to = params.to ? parseDateOnly(params.to) : null;
  if (from || to) {
    where.reportDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const query = params.query?.trim();
  if (query) where.title = { contains: query, mode: 'insensitive' };

  return where;
}

/** Any status — for the admin area. */
export async function listReports(params: ListReportsParams = {}): Promise<Page<ReportListItem>> {
  const db = getDb();
  const { page, pageSize, skip, take } = normalisePagination(params.page, params.pageSize);
  const where = buildReportWhere(params);

  // One transaction, so the total and the page are read from the same snapshot.
  const [total, rows] = await db.$transaction([
    db.report.count({ where }),
    db.report.findMany({
      where,
      orderBy: orderFor(params.sort ?? 'newest'),
      skip,
      take,
      select: listSelect,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: rows.map(toListItem),
    page,
    pageSize,
    total,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

/** Published reports only — the only list the public site may use. */
export function listPublishedReports(params: Omit<ListReportsParams, 'status'> = {}) {
  return listReports({ ...params, status: 'PUBLISHED' });
}
