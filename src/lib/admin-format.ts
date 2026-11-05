// Formatting for the admin UI. Hand-rolled on purpose: Intl month names
// differ between Node and browsers ("Sep" vs "Sept"), which would make the
// server and client render different text and break hydration.

import type { AuditAction } from '@/generated/prisma/enums';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MS = 330 * 60 * 1000; // UTC+5:30, no daylight saving
const pad = (n: number) => String(n).padStart(2, '0');

/** ISO timestamp → "05 Nov 2026, 17:42 IST". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} IST`;
}

/** 'YYYY-MM-DD' → "05 Nov 2026". No time zone: it is a calendar date. */
export function formatCalendarDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  const month = MONTHS[Number(m) - 1];
  return month ? `${d} ${month} ${y}` : ymd;
}

export const CATEGORY_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  DOMESTIC: 'Domestic',
  SPECIAL: 'Special',
};

const LOGIN_FAILURE_LABELS: Record<string, string> = {
  invalid_credentials: 'wrong email or password',
  rate_limited: 'rate limited',
  pending: 'account pending',
  rejected: 'account rejected',
  inactive: 'account inactive',
};

export interface ActivityLike {
  action: AuditAction;
  actor: { name: string } | null;
  target: { type: string; label: string | null } | null;
  metadata: Record<string, string | number | boolean | null>;
}

/** One readable sentence per audit event. */
export function describeActivity(item: ActivityLike): string {
  const who = item.actor?.name ?? 'Someone';
  const whom = item.target?.label ?? (item.target?.type === 'report' ? 'a report' : 'an account');
  switch (item.action) {
    case 'SUPER_ADMIN_SEEDED':
      return `Super Admin account ${whom} was set up`;
    case 'ADMIN_CREATED':
      return `${who} added ${whom}`;
    case 'ADMIN_APPROVED':
      return `${who} approved ${whom}`;
    case 'ADMIN_REJECTED':
      return `${who} rejected ${whom}`;
    case 'ADMIN_ACTIVATED':
      return `${who} activated ${whom}`;
    case 'ADMIN_DEACTIVATED':
      return `${who} deactivated ${whom}`;
    case 'LOGIN_SUCCEEDED':
      return `${who} signed in`;
    case 'LOGIN_FAILED': {
      const reason = LOGIN_FAILURE_LABELS[String(item.metadata.reason)] ?? 'refused';
      return item.target?.label ? `Failed sign-in for ${item.target.label} (${reason})` : `Failed sign-in (${reason})`;
    }
    case 'LOGOUT':
      return `${who} signed out`;
    case 'PASSWORD_CHANGED':
      return `${who} changed their password`;
    case 'REPORT_UPLOADED':
      return `${who} uploaded ${whom}`;
    case 'REPORT_UPDATED':
      return `${who} edited ${whom}`;
    case 'REPORT_FILE_REPLACED':
      return `${who} replaced the PDF of ${whom}`;
    case 'REPORT_PUBLISHED':
      return `${who} published ${whom}`;
    case 'REPORT_ARCHIVED':
      return `${who} archived ${whom}`;
    case 'REPORT_DELETED':
      return `${who} deleted ${whom}`;
    default:
      return 'Activity';
  }
}
