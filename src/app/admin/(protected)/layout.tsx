import AdminShell from '@/components/admin/AdminShell';
import { can } from '@/lib/auth/permissions';
import { getAccessRequestCounts } from '@/lib/server/auth/access-requests';
import { requireAdminPage } from '@/lib/server/auth/guards';
import { describeErrorSafely } from '@/lib/server/safe-error';

// Guards the first render of every protected page. Each page also guards
// itself, because layouts are not re-run on client-side navigation.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdminPage();
  const { admin } = ctx;
  const reviewsAccess = can(admin.role, 'access-requests:review');
  // The badge is a convenience: if it cannot be counted (e.g. the access
  // request migration is not applied yet) the link still shows, without it.
  const accessRequests = reviewsAccess
    ? await getAccessRequestCounts(ctx).then(
        (c) => ({ pending: c.PENDING }),
        (error) => {
          console.error(`[admin] access request count unavailable: ${describeErrorSafely(error)}`);
          return { pending: 0 };
        },
      )
    : null;
  return (
    <AdminShell admin={{ name: admin.name, role: admin.role }} canManageAdmins={can(admin.role, 'admins:view')} accessRequests={accessRequests}>
      {children}
    </AdminShell>
  );
}
