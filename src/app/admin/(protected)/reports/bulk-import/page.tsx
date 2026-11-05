import type { Metadata } from 'next';
import BulkImportWorkspace from '@/components/admin/BulkImportWorkspace';
import { LinkButton } from '@/components/admin/LinkButton';
import { PageHeader } from '@/components/admin/ui';
import { can } from '@/lib/auth/permissions';
import { DEFAULT_IMPORT_BATCH_SIZE, MAX_IMPORT_BATCH_SIZE } from '@/lib/reports/bulk-import';
import { requirePermissionPage } from '@/lib/server/auth/guards';
import { getStorageStatus } from '@/lib/server/storage';

export const metadata: Metadata = { title: 'Bulk import' };
export const dynamic = 'force-dynamic';

/** Rows uploaded at the same time. REPORT_IMPORT_BATCH_SIZE (1–10) overrides. */
function batchSize(): number {
  const n = Number.parseInt(process.env.REPORT_IMPORT_BATCH_SIZE ?? '', 10);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_IMPORT_BATCH_SIZE) : DEFAULT_IMPORT_BATCH_SIZE;
}

export default async function BulkImportPage() {
  const { admin } = await requirePermissionPage('reports:create');
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Bulk import"
        description="Add many historical reports at once: a CSV describing each report, plus its PDFs. Nothing is saved until you review and confirm."
        actions={
          <LinkButton href="/admin/reports" $variant="secondary">
            ← All reports
          </LinkButton>
        }
      />
      <BulkImportWorkspace batchSize={batchSize()} storageReady={getStorageStatus().configured} canPublish={can(admin.role, 'reports:publish')} />
    </>
  );
}
