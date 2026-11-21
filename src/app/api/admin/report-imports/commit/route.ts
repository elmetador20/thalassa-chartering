import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { adminJsonPost, routeRequestMeta } from '@/lib/server/http';
import { commitImportRow } from '@/lib/server/reports/bulk-import';

// Bulk import, one row: verify the uploaded PDF and create the report (the
// same path as a single upload: verify → copy → insert + audit). Safe to
// repeat — a row that already became a report is returned, not duplicated.
// An API route rather than a server action so rows can run in parallel.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(request: NextRequest) {
  return adminJsonPost(
    request,
    'report import commit',
    async (session, body) => {
      const created = await commitImportRow(session, body, { request: routeRequestMeta(request) });
      if (!created.duplicate) {
        revalidatePath('/admin/reports', 'layout');
        revalidatePath('/reports', 'layout');
      }
      return created;
    },
    { maxBytes: 16 * 1024 },
  );
}
