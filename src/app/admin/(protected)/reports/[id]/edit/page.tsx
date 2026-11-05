import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ActivityFeed from '@/components/admin/ActivityFeed';
import { LinkButton } from '@/components/admin/LinkButton';
import { DeletePanel, ReplacePdfPanel, ReportDetailsForm, StatusPanel } from '@/components/admin/ReportEditor';
import { Columns, PageHeader, Panel, PanelHeader, PanelTitle, Stack } from '@/components/admin/ui';
import PdfViewer from '@/components/reports/PdfViewer';
import { CATEGORY_LABELS, formatCalendarDate } from '@/lib/admin-format';
import { can } from '@/lib/auth/permissions';
import { todayInIndia } from '@/lib/reports/calendar';
import { listRecentActivity } from '@/lib/server/audit';
import { requirePermissionPage } from '@/lib/server/auth/guards';
import { getReportById } from '@/lib/server/reports/queries';
import { getStorageStatus } from '@/lib/server/storage';

export const metadata: Metadata = { title: 'Edit report' };
export const dynamic = 'force-dynamic';

export default async function EditReportPage({ params }: { params: { id: string } }) {
  const { admin } = await requirePermissionPage('reports:view');
  const report = await getReportById(params.id);
  if (!report) notFound();

  const history = await listRecentActivity({ target: { type: 'report', id: report.id }, limit: 50 });
  const storageReady = getStorageStatus().configured;
  const fileUrl = `/api/admin/reports/${report.id}/file`;

  return (
    <Stack $gap={20}>
      <PageHeader
        eyebrow="Edit report"
        title={report.title}
        description={`${CATEGORY_LABELS[report.category]} · ${formatCalendarDate(report.reportDate)}`}
        actions={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <LinkButton href="/admin/reports" $variant="secondary">
              ← All reports
            </LinkButton>
            {report.status === 'PUBLISHED' && (
              <LinkButton href={`/reports/${report.slug}`} $variant="secondary" target="_blank" rel="noopener noreferrer">
                View on website
              </LinkButton>
            )}
          </div>
        }
      />

      <Columns>
        <Stack $gap={20}>
          <ReportDetailsForm report={report} today={todayInIndia()} canUpdate={can(admin.role, 'reports:update')} />
          <StatusPanel report={report} canPublish={can(admin.role, 'reports:publish')} canArchive={can(admin.role, 'reports:archive')} />
          <ReplacePdfPanel report={report} storageReady={storageReady} canReplace={can(admin.role, 'reports:replace-file')} />
        </Stack>

        <Stack $gap={20}>
          <Panel aria-labelledby="preview-heading">
            <PanelHeader>
              <PanelTitle id="preview-heading">Preview</PanelTitle>
            </PanelHeader>
            <PdfViewer
              key={`${report.fileName}-${report.fileSize}-${report.updatedAt}`}
              title={report.title}
              source={`${fileUrl}?disposition=inline&format=json`}
              openHref={`${fileUrl}?disposition=inline`}
              height="min(70vh, 760px)"
              unavailableMessage="PDF storage is not connected yet, so the preview is not available."
            />
          </Panel>

          <Panel aria-labelledby="history-heading">
            <PanelHeader>
              <PanelTitle id="history-heading">History</PanelTitle>
            </PanelHeader>
            <ActivityFeed items={history} />
          </Panel>

          {can(admin.role, 'reports:delete') && <DeletePanel report={report} storageReady={storageReady} />}
        </Stack>
      </Columns>
    </Stack>
  );
}
