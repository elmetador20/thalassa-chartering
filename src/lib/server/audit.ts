import 'server-only';
import type { AuditAction } from '@/generated/prisma/client';
import type { DbTx } from './db';
import { getDb } from './db';

// ============================================================================
// Security audit trail.
//
// Write inside the same transaction as the change being recorded whenever
// there is one, so an action and its audit record commit or roll back
// together. The table itself is append-only (database trigger).
// ============================================================================

export type AuditTargetType = 'admin_user' | 'report' | 'access_request';

/** Flat, non-sensitive context. Values are bounded in length on write. */
export type AuditMetadata = Record<string, string | number | boolean | null>;

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  targetType?: AuditTargetType | null;
  targetId?: string | null;
  metadata?: AuditMetadata;
  request?: RequestMeta | null;
}

/** Keys that must never reach the audit log, whatever a caller passes. */
const SECRET_KEY = /pass(word)?|pwd|hash|token|secret|cookie|session|credential|api[-_]?key/i;
const MAX_VALUE_LENGTH = 300;

/** Defence in depth: drops secret-looking keys and bounds string lengths. */
export function sanitiseAuditMetadata(metadata: AuditMetadata = {}): AuditMetadata {
  const clean: AuditMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEY.test(key)) continue;
    clean[key] = typeof value === 'string' ? value.slice(0, MAX_VALUE_LENGTH) : value;
  }
  return clean;
}

export async function recordAudit(db: DbTx, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId ?? null,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: sanitiseAuditMetadata(entry.metadata),
      ipAddress: entry.request?.ipAddress ?? null,
      userAgent: entry.request?.userAgent ?? null,
    },
  });
}

// ------------------------------------------------------------------- reads --

export interface ActivityItem {
  id: string;
  action: AuditAction;
  createdAt: string;
  actor: { id: string; name: string } | null;
  target: { type: string; id: string; label: string | null } | null;
  metadata: AuditMetadata;
}

/**
 * Most recent events, newest first. `actorId` limits the feed to one person's
 * own actions — what an ADMIN sees; a SUPER_ADMIN sees everyone's. `target`
 * limits it to one record — a report's history on its edit page.
 */
export async function listRecentActivity(
  options: { limit?: number; actorId?: string; target?: { type: AuditTargetType; id: string } } = {},
): Promise<ActivityItem[]> {
  const db = getDb();
  const rows = await db.auditLog.findMany({
    where: {
      ...(options.actorId ? { actorId: options.actorId } : {}),
      ...(options.target ? { targetType: options.target.type, targetId: options.target.id } : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(options.limit ?? 10, 1), 50),
    select: {
      id: true,
      action: true,
      createdAt: true,
      targetType: true,
      targetId: true,
      metadata: true,
      actor: { select: { id: true, name: true } },
    },
  });

  // Resolve targets to names in one query per kind. A deleted report keeps its
  // title in the audit metadata, so its history still reads sensibly.
  const idsOf = (type: AuditTargetType) => [...new Set(rows.filter((r) => r.targetType === type && r.targetId).map((r) => r.targetId!))];
  const adminIds = idsOf('admin_user');
  const reportIds = idsOf('report');
  const requestIds = idsOf('access_request');
  const [admins, reports, requests] = await Promise.all([
    adminIds.length ? db.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } }) : [],
    reportIds.length ? db.report.findMany({ where: { id: { in: reportIds } }, select: { id: true, title: true } }) : [],
    requestIds.length ? db.accessRequest.findMany({ where: { id: { in: requestIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const labels = new Map<string, string>([
    ...admins.map((a) => [a.id, a.name] as const),
    ...reports.map((r) => [r.id, r.title] as const),
    ...requests.map((r) => [r.id, r.fullName] as const),
  ]);

  return rows.map((row) => {
    const metadata = (row.metadata ?? {}) as AuditMetadata;
    const fallback = typeof metadata.title === 'string' ? metadata.title : null;
    return {
      id: row.id,
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor,
      target:
        row.targetType && row.targetId
          ? { type: row.targetType, id: row.targetId, label: labels.get(row.targetId) ?? fallback }
          : null,
      metadata,
    };
  });
}
