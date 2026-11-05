// ============================================================================
// Role-based access control.
//
// Permissions, not roles, are what code checks: `can(role, 'admins:approve')`
// rather than `role === 'SUPER_ADMIN'`. That keeps every rule in this one
// table, and a new capability is one line here.
//
// Imported by the UI only to decide what to *show*. Every enforcement happens
// on the server, which consults this same table.
// ============================================================================

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN';
export type AdminApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const PERMISSIONS = [
  'dashboard:view',
  'account:manage',
  // Reports
  'reports:view',
  'reports:create',
  'reports:update',
  'reports:replace-file',
  'reports:publish',
  'reports:archive',
  'reports:delete',
  // Administrator management — Super Admin only
  'admins:view',
  'admins:create',
  'admins:approve',
  'admins:set-active',
  // Activity and settings
  'activity:view-all',
  'settings:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_PERMISSIONS: readonly Permission[] = [
  'dashboard:view',
  'account:manage',
  'reports:view',
  'reports:create',
  'reports:update',
  'reports:replace-file',
  'reports:publish',
  'reports:archive',
];

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<Permission>> = {
  // Everything, including deleting reports and managing administrators.
  SUPER_ADMIN: new Set(PERMISSIONS),
  // Day-to-day report work. Cannot delete reports, see or manage other
  // administrators, view everyone's activity, or change settings.
  ADMIN: new Set(ADMIN_PERMISSIONS),
};

export function can(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
};

export const APPROVAL_LABELS: Record<AdminApprovalStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};
