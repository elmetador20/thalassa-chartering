import type { NextRequest } from 'next/server';
import { fileErrorResponse, jsonOk, readDisposition, redirectTo, wantsJson } from '@/lib/server/http';
import { createPublicFileUrl } from '@/lib/server/reports/service';

// Public preview / download of a PUBLISHED report. Drafts, archived reports
// and unknown slugs are all the same 404, so nothing unpublished can be
// discovered. Each call issues a fresh short-lived signed link; archiving a
// report stops new links immediately.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const link = await createPublicFileUrl(params.slug, readDisposition(request));
    return wantsJson(request) ? jsonOk({ url: link.url, expiresAt: link.expiresAt.toISOString() }) : redirectTo(link.url);
  } catch (error) {
    return fileErrorResponse(error, 'public report file', request, { href: '/reports', label: '← All reports' });
  }
}
