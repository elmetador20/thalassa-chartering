import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';
import type { FieldErrors } from '@/lib/validation/auth';
import type { RequestMeta } from './audit';
import { ForbiddenError } from './auth/errors';
import { validateSession, type AuthContext } from './auth/session';
import { REPORT_ERROR_STATUS, ReportError } from './reports/errors';
import { describeErrorSafely } from './safe-error';

// ============================================================================
// Helpers for API route handlers. Every response is `no-store`: these answer
// for one person at one moment (a session, a short-lived signed link).
// ============================================================================

const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;

export interface ApiErrorBody {
  error: { code: string; message: string; fieldErrors?: FieldErrors };
}

export function jsonOk<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function jsonError(status: number, code: string, message: string, fieldErrors?: FieldErrors): NextResponse {
  const body: ApiErrorBody = { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } };
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Sends the browser to a signed storage URL without leaking it onwards. */
export function redirectTo(url: string): NextResponse {
  return new NextResponse(null, {
    status: 302,
    headers: { ...NO_STORE, Location: url, 'Referrer-Policy': 'no-referrer' },
  });
}

/**
 * CSRF defence for state-changing requests, on top of the SameSite=Strict
 * session cookie: the browser-set Origin must be this site. Compared with the
 * Host the request was addressed to (as Next.js does for server actions), so
 * it works behind a proxy that sets X-Forwarded-Host. A request without an
 * Origin is refused unless Fetch Metadata says it is same-origin.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
  if (!host) return false;
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

/** The signed-in admin, re-validated against the database (never trusted from
 *  the middleware's cookie-presence check). */
export function routeSession(request: NextRequest): Promise<AuthContext | null> {
  return validateSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export function routeRequestMeta(request: NextRequest): RequestMeta {
  const h = request.headers;
  const ip = h.get('x-real-ip')?.trim() || h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  return { ipAddress: ip ? ip.slice(0, 64) : null, userAgent: h.get('user-agent')?.slice(0, 512) ?? null };
}

/** Reads a small JSON body; null when it is missing, too large or malformed. */
export async function readJsonBody(request: NextRequest, maxBytes = 4096): Promise<unknown | null> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return null;
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return null;
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Maps the expected refusals to their status; anything else is logged
 *  safely and answered with a generic 500 that reveals nothing. */
export function errorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof ForbiddenError) return jsonError(403, 'forbidden', error.message);
  if (error instanceof ReportError) {
    return jsonError(REPORT_ERROR_STATUS[error.code], error.code, error.message, error.fieldErrors);
  }
  console.error(`[api] ${context} failed: ${describeErrorSafely(error)}`);
  return jsonError(500, 'internal', 'Something went wrong. Please try again.');
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A minimal self-contained page for people who followed a file link in the
 *  browser (download / open in new tab) — they should never see raw JSON. */
export function htmlErrorPage(status: number, title: string, message: string, back: { href: string; label: string }): NextResponse {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)} — INCWORX</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F5F7F8;color:#003366;font-family:"Helvetica Neue",Arial,sans-serif}main{max-width:34rem;padding:2rem 1.25rem}h1{font-weight:500;font-size:1.6rem;margin:0 0 .75rem}p{color:#41576B;line-height:1.6;margin:0 0 1.5rem}a{color:#003366;font-weight:500}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(back.href)}">${escapeHtml(back.label)}</a></main></body></html>`;
  return new NextResponse(html, { status, headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' } });
}

/** Error answer for the file endpoints: JSON for the viewer, a readable page
 *  for a person who clicked a download / open link. */
export function fileErrorResponse(error: unknown, context: string, request: NextRequest, back: { href: string; label: string }): NextResponse {
  if (wantsJson(request)) return errorResponse(error, context);
  if (error instanceof ReportError && error.code === 'not_found') {
    return htmlErrorPage(404, 'Report not found', 'This report does not exist or is no longer available.', back);
  }
  if (error instanceof ReportError && (error.code === 'storage_unavailable' || error.code === 'storage_error')) {
    return htmlErrorPage(REPORT_ERROR_STATUS[error.code], 'PDF temporarily unavailable', 'The PDF cannot be opened right now. Please try again later.', back);
  }
  if (error instanceof ForbiddenError) return htmlErrorPage(403, 'Not allowed', error.message, back);
  console.error(`[api] ${context} failed: ${describeErrorSafely(error)}`);
  return htmlErrorPage(500, 'Something went wrong', 'The PDF could not be opened. Please try again.', back);
}

export type FileDisposition = 'inline' | 'attachment';

/** `?disposition=inline` previews; anything else downloads. */
export function readDisposition(request: NextRequest): FileDisposition {
  return request.nextUrl.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment';
}

/** `?format=json` returns the signed link (for the PDF viewer); otherwise the
 *  browser is redirected to it (for plain links and downloads). */
export function wantsJson(request: NextRequest): boolean {
  return request.nextUrl.searchParams.get('format') === 'json';
}
