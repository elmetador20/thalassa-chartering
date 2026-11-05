'use client';

import { Container } from '@/components/ui';
import { Empty, LightArea, ReportsBand } from '@/components/reports/PublicReports';

// The reports could not be loaded (e.g. the database is unreachable). No
// detail is shown; it is logged on the server.
export default function ReportsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <ReportsBand eyebrow="Reports" title="Reports are temporarily unavailable" />
      <LightArea>
        <Container $wide>
          <Empty>
            <h2>Something went wrong loading the reports</h2>
            <p>
              Please try again in a moment.{' '}
              <button type="button" onClick={reset} style={{ textDecoration: 'underline', color: 'inherit', font: 'inherit' }}>
                Try again
              </button>
            </p>
          </Empty>
        </Container>
      </LightArea>
    </>
  );
}
