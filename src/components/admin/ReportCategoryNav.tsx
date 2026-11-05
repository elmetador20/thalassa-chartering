'use client';

import Link from 'next/link';
import styled from 'styled-components';
import { CATEGORY_LABELS, REPORT_CATEGORIES, type ReportCategoryValue } from '@/lib/reports/constants';
import { toQueryString, type AdminReportQuery } from '@/lib/reports/filters';

// All / Global / Domestic / Special — quick switches on the reports list that
// keep the other filters (search, status, dates). Counts cover every status.

const Nav = styled.nav`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Item = styled(Link)<{ $active: boolean }>`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.navy : theme.colors.lineOnLight)};
  background: ${({ $active, theme }) => ($active ? theme.colors.navy : '#fff')};
  color: ${({ $active, theme }) => ($active ? '#fff' : theme.colors.textOnLight)};
  font-size: 14px;
  font-weight: 500;

  span {
    font-size: 12.5px;
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }
  &:hover {
    border-color: ${({ theme }) => theme.colors.navy};
  }
`;

export default function ReportCategoryNav({
  query,
  counts,
}: {
  query: Partial<AdminReportQuery>;
  counts: Record<ReportCategoryValue, number> & { total: number };
}) {
  const items: { label: string; value: ReportCategoryValue | null; count: number }[] = [
    { label: 'All reports', value: null, count: counts.total },
    ...REPORT_CATEGORIES.map((c) => ({ label: `${CATEGORY_LABELS[c]} reports`, value: c, count: counts[c] })),
  ];
  return (
    <Nav aria-label="Report categories">
      {items.map((item) => {
        const active = (query.category ?? null) === item.value;
        return (
          <Item
            key={item.label}
            href={`/admin/reports${toQueryString(query, { category: item.value ? item.value.toLowerCase() : null })}`}
            $active={active}
            aria-current={active ? 'page' : undefined}
          >
            {item.label} <span>{item.count}</span>
          </Item>
        );
      })}
    </Nav>
  );
}
