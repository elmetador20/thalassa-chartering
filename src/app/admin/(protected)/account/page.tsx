import type { Metadata } from 'next';
import ChangePasswordForm from '@/components/admin/ChangePasswordForm';
import { Muted, PageHeader, Panel, PanelHeader, PanelTitle, Stack, StatusBadge, Strong, Sub } from '@/components/admin/ui';
import { requirePermissionPage } from '@/lib/server/auth/guards';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const { admin } = await requirePermissionPage('account:manage');

  return (
    <Stack $gap={24}>
      <PageHeader eyebrow="Account" title="Your account" />
      <Panel aria-labelledby="profile-heading">
        <PanelHeader>
          <PanelTitle id="profile-heading">Profile</PanelTitle>
          <StatusBadge status={admin.role} />
        </PanelHeader>
        <Strong>{admin.name}</Strong>
        <Sub>{admin.email}</Sub>
      </Panel>
      <Panel aria-labelledby="password-heading">
        <PanelHeader>
          <PanelTitle id="password-heading">Change password</PanelTitle>
        </PanelHeader>
        <Muted style={{ marginBottom: 18 }}>
          Changing your password signs you out on every other device. Password reset by email is not available: if you
          lose access, ask the Super Admin.
        </Muted>
        <ChangePasswordForm name={admin.name} email={admin.email} />
      </Panel>
    </Stack>
  );
}
