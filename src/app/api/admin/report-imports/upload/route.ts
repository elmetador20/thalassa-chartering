import type { NextRequest } from 'next/server';
import { adminJsonPost, routeRequestMeta } from '@/lib/server/http';
import { requestImportUpload } from '@/lib/server/reports/bulk-import';

// Bulk import, one row: a signed URL to PUT that row's PDF straight to
// storage — or, if this exact row was already imported, the existing report.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(request: NextRequest) {
  return adminJsonPost(request, 'report import upload', (session, body) =>
    requestImportUpload(session, body, { request: routeRequestMeta(request) }),
  { maxBytes: 16 * 1024 });
}
