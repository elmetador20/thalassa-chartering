'use client';

import React from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import { CATEGORY_LABELS, formatCalendarDate, formatDateTime } from '@/lib/admin-format';
import { EmptyState, ResponsiveTable, StatusBadge, Strong, Sub } from './ui';

export interface ReportRow {
  id: string;
  title: string;
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

interface Props {
  reports: ReportRow[];
  page?: number;
  totalPages?: number;
  emptyMessage?: string;
}

export default function ReportsTable({ reports, page, totalPages, emptyMessage = 'No reports have been added yet.' }: Props) {
  if (reports.length === 0) return <EmptyState>{emptyMessage}</EmptyState>;

  return (
    <>
      <ResponsiveTable>
        <thead>
          <tr>
            <th scope="col">Report</th>
            <th scope="col">Category</th>
            <th scope="col">Report date</th>
            <th scope="col">Status</th>
            <th scope="col">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td data-label="Report">
                <Strong>{report.title}</Strong>
                <Sub>{report.fileName}</Sub>
              </td>
              <td data-label="Category">{CATEGORY_LABELS[report.category] ?? report.category}</td>
              <td data-label="Report date">{formatCalendarDate(report.reportDate)}</td>
              <td data-label="Status">
                <StatusBadge status={report.status} />
              </td>
              <td data-label="Last updated">
                {formatDateTime(report.updatedAt)}
                <Sub>by {report.createdBy.name}</Sub>
              </td>
            </tr>
          ))}
        </tbody>
      </ResponsiveTable>

      {page && totalPages && totalPages > 1 && (
        <Pager aria-label="Pagination">
          {page > 1 ? <Link href={`/admin/reports?page=${page - 1}`}>← Newer</Link> : <span />}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? <Link href={`/admin/reports?page=${page + 1}`}>Older →</Link> : <span />}
        </Pager>
      )}
    </>
  );
}
