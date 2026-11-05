import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui';
import ReportFilterBar from '@/components/reports/ReportFilterBar';
import { CategoryTabs, Empty, FilterPanel, LightArea, Pagination, ReportList, ReportsBand, Summary } from '@/components/reports/PublicReports';
import { todayInIndia } from '@/lib/reports/calendar';
import { CATEGORY_LABELS, PUBLIC_PAGE_SIZE } from '@/lib/reports/constants';
import { dateBounds, describeDateFilter, parsePublicReportQuery, toQueryString } from '@/lib/reports/filters';
import { listPublishedReports } from '@/lib/server/reports/queries';

// Always rendered per request: publishing or archiving must show at once,
// and filters live in the URL.
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export function generateMetadata({ searchParams }: { searchParams: SearchParams }): Metadata {
  const query = parsePublicReportQuery(searchParams);
  const category = query.category ? CATEGORY_LABELS[query.category] : null;
  // Search and date views are thin duplicates of the main list: keep them out
  // of search engines but let crawlers follow their links.
  const narrowed = Boolean(query.q || query.dateFilter.mode !== 'all' || query.sort !== 'newest');
  return {
    title: category ? `${category} reports` : 'Reports',
    description:
      'Market intelligence reports from INCWORX — global, domestic and special research on dry bulk, chartering and commodity markets.',
    alternates: { canonical: `/reports${toQueryString({ category: query.category, page: query.page })}` },
    robots: narrowed ? { index: false, follow: true } : undefined,
  };
}

export default async function ReportsIndexPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parsePublicReportQuery(searchParams);
  const result = await listPublishedReports({
    category: query.category,
    query: query.q,
    ...dateBounds(query.dateFilter),
    sort: query.sort,
    page: query.page,
    pageSize: PUBLIC_PAGE_SIZE,
  });
  const narrowed = Boolean(query.q || query.dateFilter.mode !== 'all');
  const when = describeDateFilter(query.dateFilter);
  const resetHref = `/reports${toQueryString({ category: query.category })}`;

  return (
    <>
      <ReportsBand
        eyebrow="Market intelligence"
        title="Reports"
        lede="Research and market reports from INCWORX Intelligence — global, domestic and special editions on dry bulk, chartering and commodities."
      />
      <LightArea>
        <Container $wide>
          <CategoryTabs query={query} />
          <FilterPanel>
            <ReportFilterBar key={toQueryString(query)} basePath="/reports" query={query} today={todayInIndia()} keepCategory />
          </FilterPanel>

          <Summary role="status">
            {result.total === 0 ? 'No reports found' : `${result.total} report${result.total === 1 ? '' : 's'}`}
            {query.q ? ` matching “${query.q}”` : ''}
            {when ? ` · ${when}` : ''}
            {narrowed && <Link href={resetHref}>Clear search</Link>}
          </Summary>

          {result.items.length > 0 ? (
            <>
              <ReportList items={result.items} />
              <Pagination query={query} page={result.page} totalPages={result.totalPages} />
            </>
          ) : (
            <Empty>
              <h2>{narrowed || query.category ? 'No reports match your search' : 'Reports are on their way'}</h2>
              <p>
                {narrowed || query.category ? (
                  <>
                    Try a different date or search term, or <Link href="/reports">see all reports</Link>.
                  </>
                ) : (
                  'Published reports will appear here.'
                )}
              </p>
            </Empty>
          )}
        </Container>
      </LightArea>
    </>
  );
}
