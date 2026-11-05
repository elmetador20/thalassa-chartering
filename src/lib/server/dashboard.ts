import 'server-only';
import type { ReportCategory, ReportStatus } from '@/generated/prisma/client';
import { getDb } from './db';

export type ReportStatusCounts = Record<ReportStatus, number> & { total: number };

export async function getReportStatusCounts(): Promise<ReportStatusCounts> {
  const groups = await getDb().report.groupBy({ by: ['status'], _count: { _all: true } });
  const counts: ReportStatusCounts = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0, total: 0 };
  for (const g of groups) {
    counts[g.status] = g._count._all;
    counts.total += g._count._all;
  }
  return counts;
}

export type ReportCategoryCounts = Record<ReportCategory, number> & { total: number };

/** Reports per category. `status` limits it (the public site counts PUBLISHED only). */
export async function getReportCategoryCounts(status?: ReportStatus): Promise<ReportCategoryCounts> {
  const groups = await getDb().report.groupBy({ by: ['category'], where: status ? { status } : undefined, _count: { _all: true } });
  const counts: ReportCategoryCounts = { GLOBAL: 0, DOMESTIC: 0, SPECIAL: 0, total: 0 };
  for (const g of groups) {
    counts[g.category] = g._count._all;
    counts.total += g._count._all;
  }
  return counts;
}
