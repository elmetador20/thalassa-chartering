import type { MetadataRoute } from 'next';
import { listPublishedReportSlugs } from '@/lib/server/reports/queries';
import { describeErrorSafely } from '@/lib/server/safe-error';

// Built per request so a newly published report is listed straight away and
// an archived one disappears. If the database is unreachable the static
// pages are still listed — a sitemap should never fail outright.

export const dynamic = 'force-dynamic';

const SITE = 'https://incworx.in';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE}/reports`, changeFrequency: 'daily', priority: 0.8 },
  ];
  try {
    const reports = await listPublishedReportSlugs();
    for (const r of reports) {
      pages.push({ url: `${SITE}/reports/${r.slug}`, lastModified: r.updatedAt, changeFrequency: 'monthly', priority: 0.6 });
    }
  } catch (error) {
    console.error(`[sitemap] reports could not be listed: ${describeErrorSafely(error)}`);
  }
  return pages;
}
