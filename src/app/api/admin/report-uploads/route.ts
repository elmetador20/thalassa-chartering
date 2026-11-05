import type { NextRequest } from 'next/server';
import { errorResponse, isSameOrigin, jsonError, jsonOk, readJsonBody, routeRequestMeta, routeSession } from '@/lib/server/http';
import { requestReportUpload } from '@/lib/server/reports/service';

// Step 1 of an upload: the browser declares the file (name, type, size) and
// receives a short-lived URL to PUT it straight to storage — the PDF never
// passes through this server. Steps 2–3 (verify, save) happen in the
// create / replace server actions.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError(403, 'forbidden_origin', 'Cross-site requests are not allowed.');

  const session = await routeSession(request);
  if (!session) return jsonError(401, 'unauthenticated', 'Your session has ended. Sign in again.');

  const body = await readJsonBody(request);
  if (body === null) return jsonError(400, 'bad_request', 'Send the file details as JSON.');

  try {
    const upload = await requestReportUpload(session, body, { request: routeRequestMeta(request) });
    return jsonOk(upload, 201);
  } catch (error) {
    return errorResponse(error, 'report upload request');
  }
}
