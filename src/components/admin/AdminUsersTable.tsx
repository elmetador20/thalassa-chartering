'use client';

import React, { useState, useTransition } from 'react';
import styled from 'styled-components';
import { approveAdminAction, rejectAdminAction, setAdminActiveAction } from '@/app/admin/actions/users';
import { formatDateTime } from '@/lib/admin-format';
import type { ActionResult } from '@/lib/forms';
import { REJECTION_REASON_MAX_LENGTH } from '@/lib/validation/auth';
import type { AdminApprovalStatus, AdminRole } from '@/lib/auth/permissions';
import { Alert, Button, EmptyState, ResponsiveTable, StatusBadge, Strong, Sub, Textarea } from './ui';

export interface AdminRow {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  approvalStatus: AdminApprovalStatus;
  isActive: boolean;
  approvedBy: { name: string } | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const RejectBox = styled.div`
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding: 14px;
  background: ${({ theme }) => theme.colors.dangerSoft};
  border-left: 3px solid ${({ theme }) => theme.colors.danger};

  label {
    font-size: 13.5px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
`;

const Feedback = styled.div`
  margin-bottom: 16px;
`;

export default function AdminUsersTable({ admins, currentAdminId }: { admins: AdminRow[]; currentAdminId: string }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  function run(id: string, action: () => Promise<ActionResult>) {
    setBusyId(id);
    setResult(null);
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      setBusyId(null);
      if (outcome.ok) {
        setRejecting(null);
        setReason('');
      }
    });
  }

  if (admins.length === 0) return <EmptyState>No administrators yet.</EmptyState>;

  return (
    <>
      {result && (
        <Feedback>
          <Alert tone={result.ok ? 'success' : 'error'}>{result.message}</Alert>
        </Feedback>
      )}

      <ResponsiveTable>
        <thead>
          <tr>
            <th scope="col">Administrator</th>
            <th scope="col">Status</th>
            <th scope="col">Approved by</th>
            <th scope="col">Last sign-in</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((admin) => {
            const isSelf = admin.id === currentAdminId;
            const manageable = admin.role === 'ADMIN' && !isSelf;
            const busy = pending && busyId === admin.id;
            const approved = admin.approvalStatus === 'APPROVED';

            return (
              <tr key={admin.id}>
                <td data-label="Administrator">
                  <Strong>
                    {admin.name}
                    {isSelf && ' (you)'}
                  </Strong>
                  <Sub>{admin.email}</Sub>
                  <Sub>Added {formatDateTime(admin.createdAt)}</Sub>
                </td>
                <td data-label="Status">
                  <Badges>
                    <StatusBadge status={admin.role} />
                    <StatusBadge status={admin.approvalStatus} />
                    {approved && <StatusBadge status={admin.isActive ? 'ACTIVE' : 'INACTIVE'} />}
                  </Badges>
                  {admin.approvalStatus === 'REJECTED' && admin.rejectionReason && (
                    <Sub>Reason: {admin.rejectionReason}</Sub>
                  )}
                </td>
                <td data-label="Approved by">
                  {admin.approvedBy ? (
                    <>
                      <Strong>{admin.approvedBy.name}</Strong>
                      <Sub>{formatDateTime(admin.approvedAt)}</Sub>
                    </>
                  ) : admin.role === 'SUPER_ADMIN' ? (
                    <Sub>Initial setup</Sub>
                  ) : (
                    <Sub>—</Sub>
                  )}
                </td>
                <td data-label="Last sign-in">{admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : 'Never'}</td>
                <td data-label="Actions">
                  {!manageable ? (
                    <Sub>{isSelf ? 'Your account' : 'Protected account'}</Sub>
                  ) : (
                    <>
                      <Actions>
                        {admin.approvalStatus !== 'APPROVED' && (
                          <Button $small $variant="success" disabled={busy} onClick={() => run(admin.id, () => approveAdminAction(admin.id))}>
                            {admin.approvalStatus === 'REJECTED' ? 'Approve again' : 'Approve'}
                          </Button>
                        )}
                        {approved && admin.isActive && (
                          <Button
                            $small
                            $variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm(`Deactivate ${admin.name}? They will be signed out immediately.`)) {
                                run(admin.id, () => setAdminActiveAction(admin.id, false));
                              }
                            }}
                          >
                            Deactivate
                          </Button>
                        )}
                        {approved && !admin.isActive && (
                          <Button $small $variant="secondary" disabled={busy} onClick={() => run(admin.id, () => setAdminActiveAction(admin.id, true))}>
                            Activate
                          </Button>
                        )}
                        {admin.approvalStatus !== 'REJECTED' && rejecting !== admin.id && (
                          <Button
                            $small
                            $variant="danger"
                            disabled={busy}
                            onClick={() => {
                              setRejecting(admin.id);
                              setReason('');
                            }}
                          >
                            Reject
                          </Button>
                        )}
                      </Actions>

                      {rejecting === admin.id && (
                        <RejectBox>
                          <label htmlFor={`reason-${admin.id}`}>Reason (optional — shown to Super Admins only)</label>
                          <Textarea
                            id={`reason-${admin.id}`}
                            value={reason}
                            maxLength={REJECTION_REASON_MAX_LENGTH}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <Actions>
                            <Button $small $variant="danger" disabled={busy} onClick={() => run(admin.id, () => rejectAdminAction(admin.id, reason))}>
                              {busy ? 'Rejecting…' : 'Confirm rejection'}
                            </Button>
                            <Button $small $variant="secondary" disabled={busy} onClick={() => setRejecting(null)}>
                              Cancel
                            </Button>
                          </Actions>
                        </RejectBox>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </ResponsiveTable>
    </>
  );
}
