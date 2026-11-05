import Link from 'next/link';
import { Container } from '@/components/ui';
import { Empty, LightArea, ReportsBand } from '@/components/reports/PublicReports';

export default function ReportNotFound() {
  return (
    <>
      <ReportsBand eyebrow="Reports" title="Report not found" />
      <LightArea>
        <Container $wide>
          <Empty>
            <h2>This report isn&apos;t available</h2>
            <p>
              It may have been moved or withdrawn. <Link href="/reports">Browse all reports</Link>
            </p>
          </Empty>
        </Container>
      </LightArea>
    </>
  );
}
