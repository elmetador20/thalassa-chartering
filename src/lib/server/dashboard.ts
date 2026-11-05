import 'server-only';
import type { ReportStatus } from '@/generated/prisma/client';
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
