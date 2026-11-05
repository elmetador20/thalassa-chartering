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

export type AuditTargetType = 'admin_user' | 'report';

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
 * own actions — what an ADMIN sees; a SUPER_ADMIN sees everyone's.
 */
export async function listRecentActivity(options: { limit?: number; actorId?: string } = {}): Promise<ActivityItem[]> {
  const db = getDb();
  const rows = await db.auditLog.findMany({
    where: options.actorId ? { actorId: options.actorId } : undefined,
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

  // Resolve admin targets to names in one query.
  const adminIds = [...new Set(rows.filter((r) => r.targetType === 'admin_user' && r.targetId).map((r) => r.targetId!))];
  const admins = adminIds.length
    ? await db.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
    : [];
  const adminNames = new Map(admins.map((a) => [a.id, a.name]));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
    target:
      row.targetType && row.targetId
        ? {
            type: row.targetType,
            id: row.targetId,
            label: row.targetType === 'admin_user' ? adminNames.get(row.targetId) ?? null : null,
          }
        : null,
    metadata: (row.metadata ?? {}) as AuditMetadata,
  }));
}
