'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import { MONTH_NAMES } from '@/lib/reports/calendar';
import { CATEGORY_LABELS, MIN_REPORT_DATE, REPORT_CATEGORIES, REPORT_STATUSES, SEARCH_MAX_LENGTH, STATUS_LABELS } from '@/lib/reports/constants';
import { toQueryString, type AdminReportQuery, type DateFilter } from '@/lib/reports/filters';

// ============================================================================
// Search + filters for report lists (admin and public). A plain GET form, so
// it works without JavaScript; with JavaScript it navigates client-side and
// omits empty fields so URLs stay short and shareable. Render it with
// `key={queryString}` so the inputs reset when the URL changes.
// ============================================================================

type DateMode = DateFilter['mode'];

const DATE_MODES: { value: DateMode; label: string }[] = [
  { value: 'all', label: 'Any date' },
  { value: 'date', label: 'Exact date' },
  { value: 'range', label: 'Date range' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

const INPUT_BORDER = '#7A8C9E';

const Form = styled.form`
  display: grid;
  gap: 14px 16px;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  align-items: end;

  .wide {
    grid-column: 1 / -1;
  }
  @media (min-width: 900px) {
    .wide {
      grid-column: span 2;
    }
  }
`;

const Group = styled.div`
  display: grid;
  gap: 6px;
  min-width: 0;

  label,
  legend {
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }

  input,
  select {
    width: 100%;
    min-height: 44px;
    padding: 9px 12px;
    border: 1px solid ${INPUT_BORDER};
    border-radius: ${({ theme }) => theme.layout.radius};
    background: #fff;
    font: inherit;
    font-size: 15px;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
`;

const Pair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button,
  a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 18px;
    border: 1px solid ${({ theme }) => theme.colors.navy};
    border-radius: ${({ theme }) => theme.layout.radius};
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }
  button {
    background: ${({ theme }) => theme.colors.navy};
    color: #fff;
  }
  button:hover {
    background: ${({ theme }) => theme.colors.navyLift};
  }
  a {
    background: #fff;
    border-color: ${INPUT_BORDER};
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  a:hover {
    border-color: ${({ theme }) => theme.colors.navy};
  }
`;

interface Props {
  basePath: string;
  query: Partial<AdminReportQuery>;
  /** 'YYYY-MM-DD', today in India — the latest selectable date. */
  today: string;
  showCategory?: boolean;
  showStatus?: boolean;
  /** Carried through searches and "Clear" (e.g. the selected category tab). */
  keepCategory?: boolean;
  searchLabel?: string;
}

export default function ReportFilterBar({ basePath, query, today, showCategory, showStatus, keepCategory, searchLabel = 'Search titles' }: Props) {
  const router = useRouter();
  const f = query.dateFilter ?? { mode: 'all' };
  const [mode, setMode] = useState<DateMode>(f.mode);
  const maxYear = Number(today.slice(0, 4));
  const years = Array.from({ length: maxYear - 1999 }, (_, i) => maxYear - i);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const get = (k: string) => {
      const v = data.get(k);
      return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    const params = new URLSearchParams();
    for (const key of ['q', 'category', 'status', 'date', 'from', 'to', 'year', 'month', 'sort']) {
      const value = get(key);
      if (value && !(key === 'sort' && value === 'newest')) params.set(key, value);
    }
    const s = params.toString();
    router.push(`${basePath}${s ? `?${s}` : ''}`);
  }

  const clearHref = `${basePath}${keepCategory && query.category ? toQueryString({ category: query.category }) : ''}`;

  return (
    <Form method="get" action={basePath} onSubmit={submit} role="search" aria-label="Filter reports">
      <Group className="wide">
        <label htmlFor="rf-q">{searchLabel}</label>
        <input id="rf-q" name="q" type="search" defaultValue={query.q ?? ''} maxLength={SEARCH_MAX_LENGTH} placeholder="e.g. iron ore" />
      </Group>

      {showCategory ? (
        <Group>
          <label htmlFor="rf-category">Category</label>
          <select id="rf-category" name="category" defaultValue={query.category?.toLowerCase() ?? ''}>
            <option value="">All categories</option>
            {REPORT_CATEGORIES.map((c) => (
              <option key={c} value={c.toLowerCase()}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Group>
      ) : (
        keepCategory && query.category && <input type="hidden" name="category" value={query.category.toLowerCase()} />
      )}

      {showStatus && (
        <Group>
          <label htmlFor="rf-status">Status</label>
          <select id="rf-status" name="status" defaultValue={query.status?.toLowerCase() ?? ''}>
            <option value="">All statuses</option>
            {REPORT_STATUSES.map((s) => (
              <option key={s} value={s.toLowerCase()}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Group>
      )}

      <Group>
        <label htmlFor="rf-mode">Report date</label>
        <select id="rf-mode" value={mode} onChange={(e) => setMode(e.target.value as DateMode)}>
          {DATE_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Group>

      {mode === 'date' && (
        <Group>
          <label htmlFor="rf-date">Date</label>
          <input id="rf-date" name="date" type="date" min={MIN_REPORT_DATE} max={today} defaultValue={f.mode === 'date' ? f.date : ''} required />
        </Group>
      )}

      {mode === 'range' && (
        <Group className="wide">
          <span id="rf-range" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Date range
          </span>
          <Pair role="group" aria-labelledby="rf-range">
            <Group>
              <label htmlFor="rf-from">From</label>
              <input id="rf-from" name="from" type="date" min={MIN_REPORT_DATE} max={today} defaultValue={f.mode === 'range' ? (f.from ?? '') : ''} />
            </Group>
            <Group>
              <label htmlFor="rf-to">To</label>
              <input id="rf-to" name="to" type="date" min={MIN_REPORT_DATE} max={today} defaultValue={f.mode === 'range' ? (f.to ?? '') : ''} />
            </Group>
          </Pair>
        </Group>
      )}

      {(mode === 'month' || mode === 'year') && (
        <Group>
          <label htmlFor="rf-year">Year</label>
          <select id="rf-year" name="year" defaultValue={f.mode === 'month' || f.mode === 'year' ? String(f.year) : String(maxYear)}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Group>
      )}

      {mode === 'month' && (
        <Group>
          <label htmlFor="rf-month">Month</label>
          <select id="rf-month" name="month" defaultValue={f.mode === 'month' ? String(f.month) : String(Number(today.slice(5, 7)))}>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </Group>
      )}

      <Group>
        <label htmlFor="rf-sort">Sort</label>
        <select id="rf-sort" name="sort" defaultValue={query.sort ?? 'newest'}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </Group>

      <Buttons>
        <button type="submit">Apply</button>
        <Link href={clearHref}>Clear</Link>
      </Buttons>
    </Form>
  );
}
