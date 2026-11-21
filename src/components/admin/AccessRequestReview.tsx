'use client';

import React, { useState, useTransition } from 'react';
import styled from 'styled-components';
import {
  approveAccessRequestAction,
  regenerateInvitationAction,
  rejectAccessRequestAction,
  type InvitationResult,
} from '@/app/admin/actions/access-requests';
import { formatDateTime } from '@/lib/admin-format';
import type { ActionResult } from '@/lib/forms';
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AssignableRole } from '@/lib/validation/access';
import { REJECTION_REASON_MAX_LENGTH } from '@/lib/validation/auth';
import { Alert, Button, Muted, Select, Stack, Textarea } from './ui';

// Review controls for one access request (Super Admin). Approve needs a role
// and an explicit confirmation; reject takes an optional reason. After an
// approval the invitation link is shown ONCE, here — only its hash is stored.

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const Confirm = styled.div<{ $tone: 'success' | 'danger' }>`
  display: grid;
  gap: 12px;
  padding: 14px;
  border-left: 3px solid ${({ $tone, theme }) => ($tone === 'success' ? theme.colors.success : theme.colors.danger)};
  background: ${({ $tone, theme }) => ($tone === 'success' ? theme.colors.successSoft : theme.colors.dangerSoft)};
  font-size: 14.5px;
  line-height: 1.5;

  label {
    display: grid;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
`;

const LinkBox = styled.div`
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid ${({ theme }) => theme.colors.navy};
  background: ${({ theme }) => theme.colors.infoSoft};

  code {
    display: block;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid ${({ theme }) => theme.colors.lineOnLight};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 13px;
    overflow-wrap: anywhere;
    user-select: all;
  }
`;

function InvitationLink({ result }: { result: Issued }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/accept-invitation#token=${result.token}`;
  return (
    <LinkBox>
      <strong>Invitation link for {result.email}</strong>
      <code>{url}</code>
      <Actions>
        <Button
          type="button"
          $small
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </Actions>
      <Muted>
        Send it to the requester through a trusted channel. It works once and expires {formatDateTime(result.expiresAt)}. It will not be shown
        again — if it is lost, generate a new one (the old one then stops working).
      </Muted>
    </LinkBox>
  );
}

type Issued = Extract<InvitationResult, { ok: true }>;
type Done = Issued | Extract<ActionResult, { ok: true }>;

/**
 * The decision area of a request page. It stays mounted while the page
 * refreshes after a decision (same component, same place), so the one-time
 * invitation link survives the refresh that follows an approval. `children`
 * is the server-rendered summary for decided requests.
 */
export default function DecisionPanel({
  requestId,
  name,
  status,
  canRegenerate,
  children,
}: {
  requestId: string;
  name: string;
  status: string;
  canRegenerate: boolean;
  children?: React.ReactNode;
}) {
  const [done, setDone] = useState<Done | null>(null);
  if (done) {
    return (
      <Stack $gap={14}>
        <Alert tone="success">{done.message}</Alert>
        {'token' in done && <InvitationLink result={done} />}
      </Stack>
    );
  }
  if (status === 'PENDING') return <ReviewPanel requestId={requestId} name={name} onDone={setDone} />;
  return (
    <Stack $gap={14}>
      {children}
      {status === 'APPROVED' && canRegenerate && <RegenerateInvitation requestId={requestId} onDone={setDone} />}
    </Stack>
  );
}

function ReviewPanel({ requestId, name, onDone }: { requestId: string; name: string; onDone: (r: Done) => void }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [role, setRole] = useState<AssignableRole>(ASSIGNABLE_ROLES[0]);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<{ ok: false; message: string } | null>(null);

  const settle = (r: InvitationResult | ActionResult) => {
    if (r.ok) onDone(r);
    else setResult(r);
    setMode('idle');
  };
  const approve = () => startTransition(async () => settle(await approveAccessRequestAction(requestId, role)));
  const reject = () => startTransition(async () => settle(await rejectAccessRequestAction(requestId, reason)));

  return (
    <Stack $gap={14}>
      {result && !result.ok && <Alert tone="error">{result.message}</Alert>}

      {mode === 'idle' && (
        <Actions>
          <Button type="button" $variant="success" onClick={() => setMode('approve')}>
            Approve…
          </Button>
          <Button type="button" $variant="danger" onClick={() => setMode('reject')}>
            Reject…
          </Button>
        </Actions>
      )}

      {mode === 'approve' && (
        <Confirm $tone="success">
          <label htmlFor="assign-role">
            Role to assign
            <Select id="assign-role" value={role} onChange={(e) => setRole(e.target.value as AssignableRole)} disabled={pending}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </label>
          <Muted>{ROLE_DESCRIPTIONS[role]} Super Admin access cannot be granted through a request.</Muted>
          <span>
            Approve <strong>{name}</strong> as <strong>{ROLE_LABELS[role]}</strong>? A single-use invitation link valid for 24 hours will be
            created. No account exists until they set their own password.
          </span>
          <Actions>
            <Button type="button" $variant="success" disabled={pending} onClick={approve}>
              {pending ? 'Approving…' : 'Confirm approval'}
            </Button>
            <Button type="button" $variant="secondary" disabled={pending} onClick={() => setMode('idle')}>
              Cancel
            </Button>
          </Actions>
        </Confirm>
      )}

      {mode === 'reject' && (
        <Confirm $tone="danger">
          <label htmlFor="reject-reason">
            Reason (optional — visible to Super Admins only)
            <Textarea id="reject-reason" value={reason} maxLength={REJECTION_REASON_MAX_LENGTH} onChange={(e) => setReason(e.target.value)} disabled={pending} />
          </label>
          <span>
            Reject the request from <strong>{name}</strong>? No account will be created.
          </span>
          <Actions>
            <Button type="button" $variant="danger" disabled={pending} onClick={reject}>
              {pending ? 'Rejecting…' : 'Confirm rejection'}
            </Button>
            <Button type="button" $variant="secondary" disabled={pending} onClick={() => setMode('idle')}>
              Cancel
            </Button>
          </Actions>
        </Confirm>
      )}
    </Stack>
  );
}

/** For an approved request whose link was lost or expired. */
function RegenerateInvitation({ requestId, onDone }: { requestId: string; onDone: (r: Done) => void }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: false; message: string } | null>(null);

  return (
    <Stack $gap={12}>
      {result && !result.ok && <Alert tone="error">{result.message}</Alert>}
      {confirming ? (
        <Confirm $tone="success">
          <span>Generate a new invitation link? Any earlier link stops working immediately.</span>
          <Actions>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await regenerateInvitationAction(requestId);
                  if (r.ok) onDone(r);
                  else setResult(r);
                  setConfirming(false);
                })
              }
            >
              {pending ? 'Generating…' : 'Generate new link'}
            </Button>
            <Button type="button" $variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </Actions>
        </Confirm>
      ) : (
        <Actions>
          <Button type="button" $variant="secondary" onClick={() => setConfirming(true)}>
            Generate new invitation link…
          </Button>
        </Actions>
      )}
    </Stack>
  );
}
