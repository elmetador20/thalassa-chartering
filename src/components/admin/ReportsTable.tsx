'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import { archiveReportAction, publishReportAction, restoreReportAction } from '@/app/admin/actions/reports';
import { CATEGORY_LABELS, formatCalendarDate, formatDateTime } from '@/lib/admin-format';
import type { ReportActionResult } from '@/lib/reports/action-types';
import { toQueryString, type AdminReportQuery } from '@/lib/reports/filters';
import { Alert, Button, EmptyState, ResponsiveTable, StatusBadge, Strong, Sub, VisuallyHidden } from './ui';

export interface ReportRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  reportDate: string;
  fileName: string;
  updatedAt: string;
  createdBy: { name: string };
}

const Pager = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.mutedOnLight};

  a {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid ${({ theme }) => theme.colors.lineOnLight};
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  a:hover {
    border-color: ${({ theme }) => theme.colors.navy};
  }
`;

const TitleLink = styled(Link)`
  color: inherit;
  &:hover strong,
  &:hover span:first-child {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  a {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid #7a8c9e;
    font-size: 13.5px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textOnLight};
    white-space: nowrap;
  }
  a:hover {
    border-color: ${({ theme }) => theme.colors.navy};
  }
`;

const Feedback = styled.div`
  margin-bottom: 16px;
`;

export interface ReportManagePermissions {
  canPublish: boolean;
  canArchive: boolean;
}

interface Props {
  reports: ReportRow[];
  page?: number;
  totalPages?: number;
  emptyMessage?: React.ReactNode;
  /** The current filters, kept when paging. */
  query?: Partial<AdminReportQuery>;
  /** Adds an actions column (the full reports list). */
  manage?: ReportManagePermissions;
}

export default function ReportsTable({ reports, page, totalPages, emptyMessage = 'No reports have been added yet.', query = {}, manage }: Props) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<ReportActionResult<null> | null>(null);

  function run(id: string, action: () => Promise<ReportActionResult<null>>) {
    setBusyId(id);
    setResult(null);
    startTransition(async () => {
      setResult(await action());
      setBusyId(null);
    });
  }

  const pageHref = (n: number) => `/admin/reports${toQueryString({ ...query, page: n })}`;

  return (
    <>
      {result && (
        <Feedback>
          <Alert tone={result.ok ? 'success' : 'error'}>{result.message}</Alert>
        </Feedback>
      )}

      {reports.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <ResponsiveTable>
          <thead>
            <tr>
              <th scope="col">Report</th>
              <th scope="col">Category</th>
              <th scope="col">Report date</th>
              <th scope="col">Status</th>
              <th scope="col">Last updated</th>
              {manage && <th scope="col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const busy = pending && busyId === report.id;
              return (
                <tr key={report.id}>
                  <td data-label="Report">
                    <TitleLink href={`/admin/reports/${report.id}/edit`}>
                      <Strong>{report.title}</Strong>
                    </TitleLink>
                    <Sub>{report.fileName}</Sub>
                  </td>
                  <td data-label="Category">{CATEGORY_LABELS[report.category] ?? report.category}</td>
                  <td data-label="Report date">{formatCalendarDate(report.reportDate)}</td>
                  <td data-label="Status">
                    <StatusBadge status={report.status} />
                  </td>
                  <td data-label="Last updated">
                    {formatDateTime(report.updatedAt)}
                    <Sub>added by {report.createdBy.name}</Sub>
                  </td>
                  {manage && (
                    <td data-label="Actions">
                      <Actions>
                        <Link href={`/admin/reports/${report.id}/edit`}>Edit</Link>
                        <a href={`/api/admin/reports/${report.id}/file?disposition=inline`} target="_blank" rel="noopener noreferrer">
                          Preview<VisuallyHidden> {report.title} (opens in a new tab)</VisuallyHidden>
                        </a>
                        {report.status === 'PUBLISHED' && (
                          <a href={`/reports/${report.slug}`} target="_blank" rel="noopener noreferrer">
                            View on site
                          </a>
                        )}
                        {manage.canPublish && report.status === 'DRAFT' && (
                          <Button $small $variant="success" disabled={busy} onClick={() => run(report.id, () => publishReportAction(report.id))}>
                            {busy ? 'Publishing…' : 'Publish'}
                          </Button>
                        )}
                        {manage.canArchive && report.status !== 'ARCHIVED' && (
                          <Button
                            $small
                            $variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              const note = report.status === 'PUBLISHED' ? ' It will be removed from the website immediately.' : '';
                              if (window.confirm(`Archive “${report.title}”?${note}`)) run(report.id, () => archiveReportAction(report.id));
                            }}
                          >
                            {busy ? 'Archiving…' : 'Archive'}
                          </Button>
                        )}
                        {manage.canArchive && report.status === 'ARCHIVED' && (
                          <Button $small $variant="secondary" disabled={busy} onClick={() => run(report.id, () => restoreReportAction(report.id))}>
                            {busy ? 'Restoring…' : 'Restore'}
                          </Button>
                        )}
                      </Actions>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </ResponsiveTable>
      )}

      {page && totalPages && totalPages > 1 && (
        <Pager aria-label="Pagination">
          {page > 1 ? <Link href={pageHref(page - 1)}>← Previous</Link> : <span />}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? <Link href={pageHref(page + 1)}>Next →</Link> : <span />}
        </Pager>
      )}
    </>
  );
}
