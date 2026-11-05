import type { Metadata } from 'next';
import ReportsTable from '@/components/admin/ReportsTable';
import { PageHeader, Panel } from '@/components/admin/ui';
import { requirePermissionPage } from '@/lib/server/auth/guards';
import { listReports } from '@/lib/server/reports/queries';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage({ searchParams }: { searchParams: { page?: string } }) {
  await requirePermissionPage('reports:view');
  const page = Number.parseInt(searchParams.page ?? '1', 10);
  const result = await listReports({ page: Number.isFinite(page) ? page : 1, pageSize: 20 });

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description={`${result.total} report${result.total === 1 ? '' : 's'} across every status, newest report date first.`}
      />
      <Panel>
        <ReportsTable reports={result.items} page={result.page} totalPages={result.totalPages} />
      </Panel>
    </>
  );
}
