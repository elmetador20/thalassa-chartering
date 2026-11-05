'use client';

import React from 'react';
import Link from 'next/link';
import styled, { css } from 'styled-components';
import { formatCalendarDate } from '@/lib/admin-format';
import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS, formatFileSize, REPORT_CATEGORIES, type ReportCategoryValue } from '@/lib/reports/constants';
import { toQueryString, type PublicReportQuery } from '@/lib/reports/filters';
import { ArrowRight } from '../icons';
import { Container, Lede, SectionLabel } from '../ui';

// ============================================================================
// Public report pages, in the site's editorial language: a navy header band,
// then light content with thin rules — no boxed cards, no shadows.
// ============================================================================

export interface PublicReportItem {
  title: string;
  slug: string;
  description: string | null;
  category: string;
  reportDate: string;
  fileSize: number;
}

// ------------------------------------------------------------------ header --

const Band = styled.header`
  background: ${({ theme }) => theme.colors.navyDeep};
  color: ${({ theme }) => theme.colors.textOnDark};
  padding-top: calc(var(--nav-h) + clamp(36px, 6vw, 84px));
  padding-bottom: clamp(36px, 5vw, 68px);
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnDark};
`;

const BandTitle = styled.h1`
  margin-top: 18px;
  max-width: 22ch;
  font-size: ${({ theme }) => theme.type.h1};
  font-weight: 500;
  line-height: 1.04;
  letter-spacing: -0.028em;
  overflow-wrap: anywhere;
`;

const BandLede = styled(Lede)`
  margin-top: 18px;
  max-width: 60ch;
`;

export function ReportsBand({ eyebrow, title, lede, children }: { eyebrow: string; title: string; lede?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <Band>
      <Container $wide>
        <SectionLabel>{eyebrow}</SectionLabel>
        <BandTitle>{title}</BandTitle>
        {lede && <BandLede>{lede}</BandLede>}
        {children}
      </Container>
    </Band>
  );
}

export const LightArea = styled.div`
  background: ${({ theme }) => theme.colors.offWhite};
  color: ${({ theme }) => theme.colors.textOnLight};
  padding-block: clamp(28px, 4vw, 56px) clamp(56px, 7vw, 104px);
`;

// -------------------------------------------------------------------- tabs --

const Tabs = styled.nav`
  display: flex;
  gap: clamp(18px, 2.6vw, 36px);
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  margin-bottom: clamp(20px, 3vw, 32px);

  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tab = styled(Link)<{ $active: boolean }>`
  position: relative;
  flex: none;
  padding: 14px 0;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  color: ${({ $active, theme }) => ($active ? theme.colors.textOnLight : theme.colors.mutedOnLight)};

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    background: ${({ theme }) => theme.colors.orange};
    transform: scaleX(${({ $active }) => ($active ? 1 : 0)});
    transform-origin: left;
    transition: transform 0.35s ${({ theme }) => theme.motion.ease};
  }
  &:hover {
    color: ${({ theme }) => theme.colors.textOnLight};
  }
`;

export function CategoryTabs({ query }: { query: PublicReportQuery }) {
  const tabs: { label: string; value: ReportCategoryValue | null }[] = [
    { label: 'All reports', value: null },
    ...REPORT_CATEGORIES.map((c) => ({ label: `${CATEGORY_LABELS[c]} Reports`, value: c })),
  ];
  return (
    <Tabs aria-label="Report categories">
      {tabs.map((t) => {
        const active = (query.category ?? null) === t.value;
        return (
          <Tab
            key={t.label}
            href={`/reports${toQueryString(query, { category: t.value ? t.value.toLowerCase() : null })}`}
            $active={active}
            aria-current={active ? 'page' : undefined}
            scroll={false}
          >
            {t.label}
          </Tab>
        );
      })}
    </Tabs>
  );
}

// ------------------------------------------------------------- categories --

const Overview = styled.ul`
  display: grid;
  gap: 1px;
  margin-bottom: clamp(24px, 3vw, 36px);
  background: ${({ theme }) => theme.colors.lineOnLight};
  border: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  @media (min-width: 860px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: clamp(18px, 2.4vw, 28px);
    background: #fff;
  }
  h2 {
    font-size: clamp(19px, 0.6vw + 16px, 23px);
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  p {
    font-size: 15px;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.bodyOnLight};
  }
  .foot {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 6px;
    font-size: 13.5px;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
  a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.navy};
  }
`;

/** The three categories side by side, each with its published count. */
export function CategoryOverview({ counts }: { counts: Record<ReportCategoryValue, number> }) {
  return (
    <Overview aria-label="Report categories">
      {REPORT_CATEGORIES.map((c) => (
        <li key={c}>
          <SectionLabel $onDark={false}>{CATEGORY_LABELS[c]}</SectionLabel>
          <h2>{CATEGORY_LABELS[c]} Reports</h2>
          <p>{CATEGORY_DESCRIPTIONS[c]}</p>
          <div className="foot">
            <span>
              {counts[c]} report{counts[c] === 1 ? '' : 's'}
            </span>
            <Link href={`/reports?category=${c.toLowerCase()}`}>
              View {CATEGORY_LABELS[c].toLowerCase()} reports <ArrowRight size={15} />
            </Link>
          </div>
        </li>
      ))}
    </Overview>
  );
}

const Intro = styled.div`
  margin-bottom: clamp(20px, 3vw, 28px);
  h2 {
    font-size: clamp(22px, 1vw + 16px, 30px);
    font-weight: 500;
    letter-spacing: -0.01em;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  p {
    margin-top: 8px;
    max-width: 64ch;
    font-size: 15.5px;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.bodyOnLight};
  }
`;

/** Heading + description for the selected category. */
export function CategoryIntro({ category, count }: { category: ReportCategoryValue; count: number }) {
  return (
    <Intro>
      <h2>{CATEGORY_LABELS[category]} Reports</h2>
      <p>
        {CATEGORY_DESCRIPTIONS[category]} {count} published report{count === 1 ? '' : 's'}.
      </p>
    </Intro>
  );
}

// ------------------------------------------------------------------- list --

export const FilterPanel = styled.div`
  background: #fff;
  border: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  padding: clamp(16px, 2.2vw, 24px);
`;

export const Summary = styled.p`
  margin: clamp(22px, 3vw, 32px) 0 6px;
  font-size: 14.5px;
  color: ${({ theme }) => theme.colors.mutedOnLight};

  a {
    margin-left: 8px;
    color: ${({ theme }) => theme.colors.navy};
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const List = styled.ol`
  display: grid;
  column-gap: clamp(24px, 3vw, 44px);
  @media (min-width: 760px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (min-width: 1140px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const Entry = styled.li`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: clamp(20px, 2.4vw, 28px) 0;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnLight};
`;

const EntryMeta = styled.p`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.mutedOnLight};

  .cat {
    color: ${({ theme }) => theme.colors.orangeOnLight};
  }
`;

const EntryTitle = styled.h2`
  font-size: clamp(19px, 0.7vw + 15px, 23px);
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;

  a {
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  a:hover {
    text-decoration: underline;
    text-decoration-color: ${({ theme }) => theme.colors.orange};
    text-underline-offset: 4px;
  }
`;

const EntryText = styled.p`
  font-size: 15px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.bodyOnLight};
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const EntryFoot = styled.div`
  margin-top: auto;
  padding-top: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.mutedOnLight};

  a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.navy};
  }
  a svg {
    transition: transform 0.35s ${({ theme }) => theme.motion.ease};
  }
  a:hover svg {
    transform: translateX(5px);
  }
`;

export function ReportList({ items }: { items: PublicReportItem[] }) {
  return (
    <List>
      {items.map((r) => (
        <Entry key={r.slug}>
          <EntryMeta>
            <span className="cat">{CATEGORY_LABELS[r.category as ReportCategoryValue] ?? r.category}</span>
            <time dateTime={r.reportDate}>{formatCalendarDate(r.reportDate)}</time>
          </EntryMeta>
          <EntryTitle>
            <Link href={`/reports/${r.slug}`}>{r.title}</Link>
          </EntryTitle>
          {r.description && <EntryText>{r.description}</EntryText>}
          <EntryFoot>
            <span>
              PDF · {formatFileSize(r.fileSize)} ·{' '}
              <a href={`/api/reports/${r.slug}/file`} rel="nofollow" className="download" aria-label={`Download ${r.title} (PDF)`}>
                Download
              </a>
            </span>
            <Link href={`/reports/${r.slug}`} aria-label={`Preview and read ${r.title}`}>
              Read report <ArrowRight size={15} />
            </Link>
          </EntryFoot>
        </Entry>
      ))}
    </List>
  );
}

export const Empty = styled.div`
  padding: clamp(40px, 6vw, 80px) 0;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  text-align: center;

  h2 {
    font-size: clamp(20px, 1vw + 15px, 26px);
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  p {
    margin-top: 10px;
    font-size: 15px;
    color: ${({ theme }) => theme.colors.bodyOnLight};
  }
  a {
    color: ${({ theme }) => theme.colors.navy};
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

// -------------------------------------------------------------- pagination --

const Pager = styled.nav`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: clamp(24px, 3vw, 40px);
  padding-top: 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.lineOnLight};
`;

const pageBox = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0 12px;
  font-size: 14.5px;
  font-weight: 500;
`;

const PageLink = styled(Link)<{ $current?: boolean }>`
  ${pageBox}
  border: 1px solid ${({ $current, theme }) => ($current ? theme.colors.navy : theme.colors.lineOnLight)};
  background: ${({ $current, theme }) => ($current ? theme.colors.navy : '#fff')};
  color: ${({ $current, theme }) => ($current ? '#fff' : theme.colors.textOnLight)};
  &:hover {
    border-color: ${({ theme }) => theme.colors.navy};
  }
`;

const Gap = styled.span`
  ${pageBox}
  color: ${({ theme }) => theme.colors.mutedOnLight};
`;

function pageWindow(page: number, total: number): (number | 'gap')[] {
  const pages = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

export function Pagination({ query, page, totalPages }: { query: PublicReportQuery; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (n: number) => `/reports${toQueryString({ ...query, page: n })}`;
  return (
    <Pager aria-label="Pages">
      {page > 1 && (
        <PageLink href={href(page - 1)} rel="prev">
          ← Previous
        </PageLink>
      )}
      {pageWindow(page, totalPages).map((n, i) =>
        n === 'gap' ? (
          <Gap key={`gap-${i}`} aria-hidden>
            …
          </Gap>
        ) : (
          <PageLink key={n} href={href(n)} $current={n === page} aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`}>
            {n}
          </PageLink>
        ),
      )}
      {page < totalPages && (
        <PageLink href={href(page + 1)} rel="next">
          Next →
        </PageLink>
      )}
    </Pager>
  );
}

// ------------------------------------------------------------------ detail --

const Back = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: clamp(20px, 3vw, 32px);
  font-size: 14.5px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.bodyOnDark};
  &:hover {
    color: #fff;
  }
`;

const Facts = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 14px clamp(24px, 3vw, 44px);
  margin-top: clamp(22px, 3vw, 32px);

  div {
    display: grid;
    gap: 4px;
  }
  dt {
    font-size: 12.5px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.steel};
  }
  dd {
    margin: 0;
    font-size: 15.5px;
    color: #fff;
  }
`;

const DetailActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: clamp(24px, 3vw, 36px);
`;

const ActionLink = styled.a<{ $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 50px;
  padding: 0 24px;
  border: 1px solid ${({ $primary, theme }) => ($primary ? theme.colors.orange : theme.colors.lineOnDark)};
  background: ${({ $primary, theme }) => ($primary ? theme.colors.orange : 'transparent')};
  color: ${({ $primary, theme }) => ($primary ? theme.colors.navy : '#fff')};
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.2s ease, border-color 0.2s ease;

  &:hover {
    ${({ $primary, theme }) =>
      $primary
        ? css`
            background: ${theme.colors.orangeHover};
            border-color: ${theme.colors.orangeHover};
          `
        : css`
            border-color: rgba(255, 255, 255, 0.5);
            background: rgba(255, 255, 255, 0.06);
          `}
  }
`;

export function ReportDetailHeader({ report }: { report: PublicReportItem }) {
  const file = `/api/reports/${report.slug}/file`;
  return (
    <Band>
      <Container $wide>
        <Back href="/reports">← All reports</Back>
        <SectionLabel>{CATEGORY_LABELS[report.category as ReportCategoryValue] ?? report.category}</SectionLabel>
        <BandTitle>{report.title}</BandTitle>
        <Facts>
          <div>
            <dt>Report date</dt>
            <dd>
              <time dateTime={report.reportDate}>{formatCalendarDate(report.reportDate)}</time>
            </dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>PDF · {formatFileSize(report.fileSize)}</dd>
          </div>
        </Facts>
        <DetailActions>
          <ActionLink $primary href={file} rel="nofollow">
            Download PDF
          </ActionLink>
          <ActionLink href={`${file}?disposition=inline`} target="_blank" rel="nofollow noopener noreferrer">
            Open in new tab
          </ActionLink>
        </DetailActions>
      </Container>
    </Band>
  );
}

export const Description = styled.p`
  max-width: 72ch;
  margin-bottom: clamp(24px, 3vw, 36px);
  font-size: ${({ theme }) => theme.type.bodyLg};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.bodyOnLight};
  white-space: pre-line;
`;
