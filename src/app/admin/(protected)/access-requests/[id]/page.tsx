import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DecisionPanel from '@/components/admin/AccessRequestReview';
import ActivityFeed from '@/components/admin/ActivityFeed';
import { LinkButton } from '@/components/admin/LinkButton';
import { Alert, Columns, Muted, PageHeader, Panel, PanelHeader, PanelTitle, Stack, StatusBadge } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/admin-format';
import { ROLE_LABELS } from '@/lib/validation/access';
import { listRecentActivity } from '@/lib/server/audit';
import { getAccessRequest } from '@/lib/server/auth/access-requests';
import { requirePermissionPage } from '@/lib/server/auth/guards';

export const metadata: Metadata = { title: 'Access request' };
export const dynamic = 'force-dynamic';

const dl: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(120px, auto) minmax(0, 1fr)', gap: '10px 18px', fontSize: 14.5 };
const dt: React.CSSProperties = { color: '#52677A' };
const dd: React.CSSProperties = { margin: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-line' };

const INVITATION_LABELS = {
  pending: 'Waiting for the requester to set a password',
  accepted: 'Accepted — account created',
  expired: 'Expired — not used within 24 hours',
  revoked: 'Replaced by a newer link',
} as const;

export default async function AccessRequestPage({ params }: { params: { id: string } }) {
  const ctx = await requirePermissionPage('access-requests:review');
  const r = await getAccessRequest(ctx, params.id);
  if (!r) notFound();
  const history = await listRecentActivity({ target: { type: 'access_request', id: r.id }, limit: 50 });

  return (
    <Stack $gap={20}>
      <PageHeader
        eyebrow="Access request"
        title={r.fullName}
        description={`${r.email} · submitted ${formatDateTime(r.createdAt)}`}
        actions={
          <LinkButton href="/admin/access-requests" $variant="secondary">
            ← All requests
          </LinkButton>
        }
      />

      <Columns>
        <Stack $gap={20}>
          <Panel aria-labelledby="details-heading">
            <PanelHeader>
              <PanelTitle id="details-heading">Request</PanelTitle>
              <StatusBadge status={r.status} />
            </PanelHeader>
            <dl style={dl}>
              <dt style={dt}>Full name</dt>
              <dd style={dd}>{r.fullName}</dd>
              <dt style={dt}>Work email</dt>
              <dd style={dd}>{r.email}</dd>
              <dt style={dt}>Company / department</dt>
              <dd style={dd}>{r.department}</dd>
              <dt style={dt}>Designation</dt>
              <dd style={dd}>{r.designation}</dd>
              <dt style={dt}>Reason for access</dt>
              <dd style={dd}>{r.reason}</dd>
              <dt style={dt}>Submitted</dt>
              <dd style={dd}>{formatDateTime(r.createdAt)}</dd>
              {r.reviewedAt && (
                <>
                  <dt style={dt}>Reviewed</dt>
                  <dd style={dd}>
                    {formatDateTime(r.reviewedAt)} by {r.reviewedBy?.name ?? '—'}
                  </dd>
                </>
              )}
              {r.assignedRole && (
                <>
                  <dt style={dt}>Assigned role</dt>
                  <dd style={dd}>{ROLE_LABELS[r.assignedRole] ?? r.assignedRole}</dd>
                </>
              )}
              {r.rejectionReason && (
                <>
                  <dt style={dt}>Rejection reason</dt>
                  <dd style={dd}>{r.rejectionReason}</dd>
                </>
              )}
            </dl>
          </Panel>

          <Panel aria-labelledby="decision-heading">
            <PanelHeader>
              <PanelTitle id="decision-heading">{r.status === 'PENDING' ? 'Decision' : r.status === 'APPROVED' ? 'Invitation' : 'Decision'}</PanelTitle>
            </PanelHeader>
            {r.status === 'PENDING' && r.accountExists && (
              <div style={{ marginBottom: 14 }}>
                <Alert tone="info">An administrator account already uses this email address, so this request cannot be approved.</Alert>
              </div>
            )}
            {/* One component in every state, so a just-issued link survives the page refresh. */}
            <DecisionPanel requestId={r.id} name={r.fullName} status={r.status} canRegenerate={r.invitation?.state !== 'accepted' && !r.accountExists}>
              {r.status === 'APPROVED' &&
                (r.invitation ? (
                  <dl style={dl}>
                    <dt style={dt}>Status</dt>
                    <dd style={dd}>{INVITATION_LABELS[r.invitation.state]}</dd>
                    <dt style={dt}>Link created</dt>
                    <dd style={dd}>
                      {formatDateTime(r.invitation.createdAt)} by {r.invitation.createdBy}
                    </dd>
                    <dt style={dt}>{r.invitation.state === 'accepted' ? 'Accepted' : 'Expires'}</dt>
                    <dd style={dd}>{formatDateTime(r.invitation.state === 'accepted' ? r.invitation.usedAt : r.invitation.expiresAt)}</dd>
                  </dl>
                ) : (
                  <Muted>No invitation has been issued.</Muted>
                ))}
              {r.status === 'APPROVED' && r.invitation?.state === 'accepted' && <Muted>The account appears under Administrators.</Muted>}
              {r.status === 'REJECTED' && <Muted>This request was rejected. No account was created. The person can submit a new request.</Muted>}
            </DecisionPanel>
          </Panel>
        </Stack>

        <Panel aria-labelledby="history-heading">
          <PanelHeader>
            <PanelTitle id="history-heading">History</PanelTitle>
          </PanelHeader>
          <ActivityFeed items={history} />
        </Panel>
      </Columns>
    </Stack>
  );
}
