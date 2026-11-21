import type { Metadata } from 'next';
import { LinkButton } from '@/components/admin/LinkButton';
import ReportUploadForm from '@/components/admin/ReportUploadForm';
import { PageHeader } from '@/components/admin/ui';
import { can } from '@/lib/auth/permissions';
import { todayInIndia } from '@/lib/reports/calendar';
import { requirePermissionPage } from '@/lib/server/auth/guards';
import { getStorageStatus } from '@/lib/server/storage';

export const metadata: Metadata = { title: 'Upload report' };
export const dynamic = 'force-dynamic';

export default async function NewReportPage() {
  const { admin } = await requirePermissionPage('reports:create');
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Upload a report"
        description="Add one PDF report. Historical reports can be added with their original report date."
        actions={
          <LinkButton href="/admin/reports" $variant="secondary">
            ← All reports
          </LinkButton>
        }
      />
      <ReportUploadForm today={todayInIndia()} canPublish={can(admin.role, 'reports:publish')} storageReady={getStorageStatus().configured} />
    </>
  );
}
