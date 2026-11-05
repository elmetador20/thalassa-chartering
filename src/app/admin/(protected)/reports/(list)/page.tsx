import type { Metadata } from 'next';
import Link from 'next/link';
import ReportsTable from '@/components/admin/ReportsTable';
import { Alert, PageHeader, Panel, Stack } from '@/components/admin/ui';
import ReportFilterBar from '@/components/reports/ReportFilterBar';
import { can } from '@/lib/auth/permissions';
import { todayInIndia } from '@/lib/reports/calendar';
import { ADMIN_PAGE_SIZE } from '@/lib/reports/constants';
import { dateBounds, describeDateFilter, parseAdminReportQuery, toQueryString } from '@/lib/reports/filters';
import { requirePermissionPage } from '@/lib/server/auth/guards';
import { listReports } from '@/lib/server/reports/queries';
import { getStorageStatus } from '@/lib/server/storage';
import { LinkButton } from '@/components/admin/LinkButton';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { admin } = await requirePermissionPage('reports:view');
  const query = parseAdminReportQuery(searchParams);
  const result = await listReports({
    status: query.status,
    category: query.category,
    query: query.q,
    ...dateBounds(query.dateFilter),
    sort: query.sort,
    page: query.page,
    pageSize: ADMIN_PAGE_SIZE,
  });
  const storage = getStorageStatus();
  const filtered = Boolean(query.q || query.status || query.category || query.dateFilter.mode !== 'all');
  const when = describeDateFilter(query.dateFilter);
  const canCreate = can(admin.role, 'reports:create');
  const notice = typeof searchParams.notice === 'string' ? searchParams.notice : null;

  return (
    <Stack $gap={20}>
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description={
          filtered
            ? `${result.total} matching report${result.total === 1 ? '' : 's'}${when ? ` · ${when}` : ''}.`
            : `${result.total} report${result.total === 1 ? '' : 's'} across every status, newest report date first.`
        }
        actions={canCreate ? <LinkButton href="/admin/reports/new">Upload report</LinkButton> : undefined}
      />

      {notice === 'deleted' && <Alert tone="success">Report permanently deleted.</Alert>}
      {notice === 'deleted-file-kept' && (
        <Alert tone="info">Report deleted. Its PDF could not be removed from storage and is listed for clean-up in the audit log.</Alert>
      )}

      {!storage.configured && (
        <Alert tone="info">
          PDF storage is not connected yet, so new PDFs cannot be uploaded and existing ones cannot be previewed. Report details can still be
          viewed and edited.
        </Alert>
      )}

      <Panel aria-label="Search and filters">
        <ReportFilterBar key={toQueryString(query)} basePath="/admin/reports" query={query} today={todayInIndia()} showCategory showStatus />
      </Panel>

      <Panel>
        <ReportsTable
          reports={result.items}
          page={result.page}
          totalPages={result.totalPages}
          query={query}
          manage={{ canPublish: can(admin.role, 'reports:publish'), canArchive: can(admin.role, 'reports:archive') }}
          emptyMessage={
            filtered ? (
              <>
                No reports match these filters. <Link href="/admin/reports">Clear filters</Link>
              </>
            ) : canCreate ? (
              <>
                No reports yet. <Link href="/admin/reports/new">Upload the first report</Link>
              </>
            ) : (
              'No reports yet.'
            )
          }
        />
      </Panel>
    </Stack>
  );
}
