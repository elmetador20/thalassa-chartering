import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Container } from '@/components/ui';
import PdfViewer from '@/components/reports/PdfViewer';
import { Description, LightArea, ReportDetailHeader } from '@/components/reports/PublicReports';
import { formatCalendarDate } from '@/lib/admin-format';
import { CATEGORY_LABELS } from '@/lib/reports/constants';
import { getPublishedReportBySlug } from '@/lib/server/reports/queries';

// Published reports only: a draft, an archived report and a wrong address
// all give the same 404.
export const dynamic = 'force-dynamic';

const getReport = cache((slug: string) => getPublishedReportBySlug(slug));

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const report = await getReport(params.slug);
  if (!report) return { title: 'Report not found', robots: { index: false, follow: false } };
  const description =
    report.description?.slice(0, 200) ??
    `${CATEGORY_LABELS[report.category]} report dated ${formatCalendarDate(report.reportDate)}, from INCWORX Intelligence.`;
  return {
    title: report.title,
    description,
    alternates: { canonical: `/reports/${report.slug}` },
    openGraph: {
      type: 'article',
      title: report.title,
      description,
      url: `/reports/${report.slug}`,
      publishedTime: report.publishedAt ?? undefined,
    },
  };
}

export default async function ReportPage({ params }: { params: { slug: string } }) {
  const report = await getReport(params.slug);
  if (!report) notFound();
  const file = `/api/reports/${report.slug}/file`;

  return (
    <>
      <ReportDetailHeader report={report} />
      <LightArea>
        <Container $wide>
          {report.description && <Description>{report.description}</Description>}
          <PdfViewer title={report.title} source={`${file}?disposition=inline&format=json`} openHref={`${file}?disposition=inline`} />
        </Container>
      </LightArea>
    </>
  );
}
