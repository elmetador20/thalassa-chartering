import type { NextRequest } from 'next/server';
import { adminJsonPost, routeRequestMeta } from '@/lib/server/http';
import { requestReportUpload } from '@/lib/server/reports/service';

// Step 1 of an upload: the browser declares the file (name, type, size) and
// receives a short-lived URL to PUT it straight to storage — the PDF never
// passes through this server. Steps 2–3 (verify, save) happen in the
// create / replace server actions.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(request: NextRequest) {
  return adminJsonPost(
    request,
    'report upload request',
    (session, body) => requestReportUpload(session, body, { request: routeRequestMeta(request) }),
    { status: 201 },
  );
}
