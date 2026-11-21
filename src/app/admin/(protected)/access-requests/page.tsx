import type { Metadata } from 'next';
import Link from 'next/link';
import { AccessRequestFilters, AccessRequestTable } from '@/components/admin/AccessRequestList';
import { PageHeader, Panel, Stack, Stat, StatGrid } from '@/components/admin/ui';
import type { AccessRequestStatus } from '@/generated/prisma/enums';
import { getAccessRequestCounts, listAccessRequests } from '@/lib/server/auth/access-requests';
import { requirePermissionPage } from '@/lib/server/auth/guards';

export const metadata: Metadata = { title: 'Access requests' };
export const dynamic = 'force-dynamic';

const STATUSES: Record<string, AccessRequestStatus> = { pending: 'PENDING', approved: 'APPROVED', rejected: 'REJECTED' };

export default async function AccessRequestsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  // Super Admin only: an ADMIN gets the same 404 as for an unknown page.
  const ctx = await requirePermissionPage('access-requests:review');
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const statusParam = one(searchParams.status).toLowerCase();
  const q = one(searchParams.q).slice(0, 100);
  const page = Number.parseInt(one(searchParams.page), 10) || 1;

  const [counts, list] = await Promise.all([
    getAccessRequestCounts(ctx),
    listAccessRequests(ctx, { status: STATUSES[statusParam], q, page }),
  ]);
  const query = (n: number) => {
    const p = new URLSearchParams();
    if (STATUSES[statusParam]) p.set('status', statusParam);
    if (q) p.set('q', q);
    if (n > 1) p.set('page', String(n));
    return `/admin/access-requests${p.toString() ? `?${p}` : ''}`;
  };

  return (
    <Stack $gap={20}>
      <PageHeader
        eyebrow="Administrators"
        title="Access requests"
        description="Requests from the public Request Access page. Approving one creates a single-use invitation; the account exists only once the person sets their own password."
      />

      <StatGrid>
        <Stat value={counts.total} label="Total requests" />
        <Stat value={counts.PENDING} label="Pending" highlight={counts.PENDING > 0} />
        <Stat value={counts.APPROVED} label="Approved" />
        <Stat value={counts.REJECTED} label="Rejected" />
      </StatGrid>

      <Panel aria-label="Search and filters">
        <AccessRequestFilters key={`${statusParam}|${q}`} status={STATUSES[statusParam] ? statusParam : ''} q={q} />
      </Panel>

      <Panel>
        <AccessRequestTable rows={list.items} filtered={Boolean(q || STATUSES[statusParam])} />
        {list.totalPages > 1 && (
          <nav aria-label="Pagination" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, fontSize: 14 }}>
            {list.page > 1 ? <Link href={query(list.page - 1)}>← Previous</Link> : <span />}
            <span>
              Page {list.page} of {list.totalPages}
            </span>
            {list.page < list.totalPages ? <Link href={query(list.page + 1)}>Next →</Link> : <span />}
          </nav>
        )}
      </Panel>
    </Stack>
  );
}
