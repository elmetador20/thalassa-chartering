import type { Metadata } from 'next';
import Link from 'next/link';
import ActivityFeed from '@/components/admin/ActivityFeed';
import { LinkButton } from '@/components/admin/LinkButton';
import ReportsTable from '@/components/admin/ReportsTable';
import { Columns, Panel, PanelHeader, PanelTitle, PageHeader, Stack, Stat, StatGrid } from '@/components/admin/ui';
import { can } from '@/lib/auth/permissions';
import { listRecentActivity } from '@/lib/server/audit';
import { getAdminCounts } from '@/lib/server/auth/admins';
import { requirePermissionPage } from '@/lib/server/auth/guards';
import { getReportStatusCounts } from '@/lib/server/dashboard';
import { listReports } from '@/lib/server/reports/queries';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const ctx = await requirePermissionPage('dashboard:view');
  const { admin } = ctx;
  const seesEveryone = can(admin.role, 'activity:view-all');
  const managesAdmins = can(admin.role, 'admins:view');

  const [reportCounts, latest, activity, adminCounts] = await Promise.all([
    getReportStatusCounts(),
    listReports({ pageSize: 5 }),
    // Super Admins see everyone's activity; admins see their own.
    listRecentActivity({ limit: 10, actorId: seesEveryone ? undefined : admin.id }),
    managesAdmins ? getAdminCounts(ctx) : Promise.resolve(null),
  ]);

  return (
    <Stack $gap={24}>
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome, ${admin.name.split(' ')[0]}`}
        actions={
          can(admin.role, 'reports:create') ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <LinkButton href="/admin/reports/bulk-import" $variant="secondary">
                Bulk CSV import
              </LinkButton>
              <LinkButton href="/admin/reports/new">Upload report</LinkButton>
            </div>
          ) : undefined
        }
      />

      {adminCounts && (
        <Panel aria-labelledby="admins-heading">
          <PanelHeader>
            <PanelTitle id="admins-heading">Administrators</PanelTitle>
            <Link href="/admin/users">Manage administrators →</Link>
          </PanelHeader>
          <StatGrid>
            <Stat value={adminCounts.pending} label="Pending approval" highlight={adminCounts.pending > 0} />
            <Stat value={adminCounts.active} label="Active" />
            <Stat value={adminCounts.inactive} label="Inactive" />
            <Stat value={adminCounts.rejected} label="Rejected" />
          </StatGrid>
        </Panel>
      )}

      <Panel aria-labelledby="reports-heading">
        <PanelHeader>
          <PanelTitle id="reports-heading">Reports</PanelTitle>
          <Link href="/admin/reports">All reports →</Link>
        </PanelHeader>
        <StatGrid>
          <Stat value={reportCounts.total} label="Total" />
          <Stat value={reportCounts.PUBLISHED} label="Published" />
          <Stat value={reportCounts.DRAFT} label="Drafts" />
          <Stat value={reportCounts.ARCHIVED} label="Archived" />
        </StatGrid>
      </Panel>

      <Columns>
        <Panel aria-labelledby="latest-heading">
          <PanelHeader>
            <PanelTitle id="latest-heading">Latest reports</PanelTitle>
          </PanelHeader>
          <ReportsTable reports={latest.items} />
        </Panel>
        <Panel aria-labelledby="activity-heading">
          <PanelHeader>
            <PanelTitle id="activity-heading">{seesEveryone ? 'Recent activity' : 'Your recent activity'}</PanelTitle>
          </PanelHeader>
          <ActivityFeed items={activity} />
        </Panel>
      </Columns>
    </Stack>
  );
}
