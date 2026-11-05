// ============================================================================
// Auth constants shared by the middleware (Edge runtime), server code and UI.
// Nothing here may import Node-only modules.
// ============================================================================

/**
 * Session cookie name. In production the `__Host-` prefix makes the browser
 * enforce Secure, Path=/ and no Domain attribute — so a sibling subdomain can
 * never plant or overwrite it. The prefix needs HTTPS, so development uses a
 * plain name.
 */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-incworx-admin' : 'incworx-admin';

export const LOGIN_PATH = '/admin/login';
/** Where a fresh sign-in lands when no `next` destination is given. */
export const DEFAULT_ADMIN_PATH = '/admin';
/** Where an already signed-in visitor to the login page is sent. */
export const SIGNED_IN_LOGIN_REDIRECT = '/admin/reports';

/** Admin-area paths only: no scheme, no `//host`, no backslash tricks. */
const SAFE_ADMIN_PATH = /^\/admin(?:\/[A-Za-z0-9\-._~%/]*)?(?:\?[A-Za-z0-9\-._~%&=+]*)?$/;

/**
 * Validates a post-login destination. Anything that is not a plain path
 * inside /admin falls back to the default — so a crafted `?next=` can never
 * send a freshly signed-in admin to another site (open redirect).
 */
export function safeAdminRedirect(next: unknown, fallback: string = DEFAULT_ADMIN_PATH): string {
  if (typeof next !== 'string' || next.length > 300) return fallback;
  if (next.startsWith('//') || next.includes('\\') || next.includes('..')) return fallback;
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`) || next.startsWith(`${LOGIN_PATH}/`)) {
    return fallback;
  }
  return SAFE_ADMIN_PATH.test(next) ? next : fallback;
}
