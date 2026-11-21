import type { NextRequest } from 'next/server';
import { adminJsonPost } from '@/lib/server/http';
import { checkImportRows } from '@/lib/server/reports/bulk-import';

// Bulk import, preview step: validates every CSV row on the server and finds
// rows already imported and existing reports that look like duplicates.
// Writes nothing.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(request: NextRequest) {
  // Up to 1,000 rows with 2,000-character descriptions.
  return adminJsonPost(request, 'report import check', (session, body) => checkImportRows(session, body), { maxBytes: 3 * 1024 * 1024 });
}
