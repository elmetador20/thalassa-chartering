'use client';

import React from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import { formatDateTime } from '@/lib/admin-format';
import { EmptyState, ResponsiveTable, StatusBadge, Strong, Sub } from './ui';

export interface AccessRequestRow {
  id: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: { name: string } | null;
}

const Filters = styled.form`
  display: grid;
  gap: 12px 14px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  align-items: end;

  label {
    display: grid;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
  input,
  select {
    min-height: 44px;
    padding: 9px 12px;
    border: 1px solid #7a8c9e;
    background: #fff;
    font: inherit;
    font-size: 15px;
    text-transform: none;
    letter-spacing: 0;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  .wide {
    grid-column: span 2;
  }
  @media (max-width: 560px) {
    .wide {
      grid-column: auto;
    }
  }
  .buttons {
    display: flex;
    gap: 8px;
  }
  button,
  a.clear {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 18px;
    border: 1px solid ${({ theme }) => theme.colors.navy};
    font-size: 15px;
    font-weight: 500;
  }
  button {
    background: ${({ theme }) => theme.colors.navy};
    color: #fff;
    cursor: pointer;
  }
  a.clear {
    border-color: #7a8c9e;
    background: #fff;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
`;

/** Plain GET form: filters live in the URL (works without JavaScript). */
export function AccessRequestFilters({ status, q }: { status: string; q: string }) {
  return (
    <Filters method="get" action="/admin/access-requests" role="search" aria-label="Filter access requests">
      <label className="wide">
        Search name or email
        <input type="search" name="q" defaultValue={q} maxLength={100} placeholder="e.g. priya or @example.com" />
      </label>
      <label>
        Status
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <div className="buttons">
        <button type="submit">Apply</button>
        <a className="clear" href="/admin/access-requests">
          Clear
        </a>
      </div>
    </Filters>
  );
}

export function AccessRequestTable({ rows, filtered }: { rows: AccessRequestRow[]; filtered: boolean }) {
  if (rows.length === 0) {
    return <EmptyState>{filtered ? 'No access requests match these filters.' : 'No access requests yet.'}</EmptyState>;
  }
  return (
    <ResponsiveTable>
      <thead>
        <tr>
          <th scope="col">Requester</th>
          <th scope="col">Company / designation</th>
          <th scope="col">Submitted</th>
          <th scope="col">Status</th>
          <th scope="col">Reviewed</th>
          <th scope="col">
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td data-label="Requester">
              <Strong>{r.fullName}</Strong>
              <Sub>{r.email}</Sub>
            </td>
            <td data-label="Company">
              <span>{r.department}</span>
              <Sub>{r.designation}</Sub>
            </td>
            <td data-label="Submitted">{formatDateTime(r.createdAt)}</td>
            <td data-label="Status">
              <StatusBadge status={r.status} />
            </td>
            <td data-label="Reviewed">
              {r.reviewedAt ? (
                <>
                  {formatDateTime(r.reviewedAt)}
                  <Sub>by {r.reviewedBy?.name ?? '—'}</Sub>
                </>
              ) : (
                <Sub>—</Sub>
              )}
            </td>
            <td data-label="Actions">
              <Link href={`/admin/access-requests/${r.id}`} style={{ fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {r.status === 'PENDING' ? 'Review' : 'View'}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  );
}
