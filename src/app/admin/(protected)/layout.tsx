import AdminShell from '@/components/admin/AdminShell';
import { can } from '@/lib/auth/permissions';
import { requireAdminPage } from '@/lib/server/auth/guards';

// Guards the first render of every protected page. Each page also guards
// itself, because layouts are not re-run on client-side navigation.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdminPage();
  return (
    <AdminShell admin={{ name: admin.name, role: admin.role }} canManageAdmins={can(admin.role, 'admins:view')}>
      {children}
    </AdminShell>
  );
}
