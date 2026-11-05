import type { Metadata } from 'next';
import AdminUsersTable from '@/components/admin/AdminUsersTable';
import CreateAdminForm from '@/components/admin/CreateAdminForm';
import { PageHeader, Panel, PanelHeader, PanelTitle, Stack } from '@/components/admin/ui';
import { can } from '@/lib/auth/permissions';
import { listAdmins } from '@/lib/server/auth/admins';
import { getCurrentSession, requirePermissionPage } from '@/lib/server/auth/guards';

// The tab title is derived from the same permission check, so the 404 a
// non-Super Admin receives doesn't still announce "Administrators".
export async function generateMetadata(): Promise<Metadata> {
  const session = await getCurrentSession();
  return { title: session && can(session.admin.role, 'admins:view') ? 'Administrators' : 'Not available' };
}

// Super Admin only: any other role gets a 404 from the guard.
export default async function UsersPage() {
  const ctx = await requirePermissionPage('admins:view');
  const admins = await listAdmins(ctx);
  const pending = admins.filter((a) => a.approvalStatus === 'PENDING').length;

  return (
    <Stack $gap={24}>
      <PageHeader
        eyebrow="Super Admin"
        title="Administrators"
        description={
          pending > 0
            ? `${pending} account${pending === 1 ? ' is' : 's are'} waiting for your approval.`
            : 'Create administrator accounts and control who can sign in.'
        }
      />
      <Panel aria-labelledby="create-heading">
        <PanelHeader>
          <PanelTitle id="create-heading">Add an administrator</PanelTitle>
        </PanelHeader>
        <CreateAdminForm />
      </Panel>
      <Panel aria-labelledby="list-heading">
        <PanelHeader>
          <PanelTitle id="list-heading">All administrators</PanelTitle>
        </PanelHeader>
        <AdminUsersTable admins={admins} currentAdminId={ctx.admin.id} />
      </Panel>
    </Stack>
  );
}
