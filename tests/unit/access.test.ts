import { describe, expect, it } from 'vitest';
import { safeAdminRedirect } from '@/lib/auth/constants';
import { can, PERMISSIONS } from '@/lib/auth/permissions';
import { sanitiseAuditMetadata } from '@/lib/server/audit';

describe('RBAC table', () => {
  it('grants a Super Admin every permission', () => {
    for (const p of PERMISSIONS) expect(can('SUPER_ADMIN', p)).toBe(true);
  });

  it.each(['reports:view', 'reports:create', 'reports:update', 'reports:replace-file', 'reports:publish', 'reports:archive'] as const)(
    'lets an Admin %s',
    (p) => {
      expect(can('ADMIN', p)).toBe(true);
    },
  );

  it.each(['admins:view', 'admins:create', 'admins:approve', 'admins:set-active', 'activity:view-all', 'settings:manage', 'reports:delete'] as const)(
    'refuses an Admin %s',
    (p) => {
      expect(can('ADMIN', p)).toBe(false);
    },
  );

  it('refuses an unknown role everything', () => {
    expect(can('OWNER' as never, 'reports:view')).toBe(false);
  });
});

describe('post-login redirect', () => {
  it.each(['/admin', '/admin/users', '/admin/reports?page=2'])('allows %s', (path) => {
    expect(safeAdminRedirect(path)).toBe(path);
  });

  it.each([
    'https://evil.example',
    '//evil.example/admin',
    '/\\evil.example',
    '/admin\\@evil.example',
    '/administrator',
    '/admin/../account',
    '/',
    'javascript:alert(1)',
    '/admin/login',
    '/admin/login?next=/admin',
  ])('refuses %s', (path) => {
    expect(safeAdminRedirect(path)).toBe('/admin');
  });
});

describe('audit metadata', () => {
  it('drops anything that looks like a secret, keeps the rest', () => {
    const clean = sanitiseAuditMetadata({
      reason: 'invalid_credentials',
      password: 'x',
      newPassword: 'x',
      passwordHash: 'x',
      sessionToken: 'x',
      apiKey: 'x',
      cookie: 'x',
      email: 'ravi@incworx.in',
    });
    expect(clean).toEqual({ reason: 'invalid_credentials', email: 'ravi@incworx.in' });
  });

  it('bounds string length', () => {
    expect(String(sanitiseAuditMetadata({ note: 'x'.repeat(1000) }).note)).toHaveLength(300);
  });
});
