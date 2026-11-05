'use client';

import { Alert, Button, PageHeader, Panel, Stack } from '@/components/admin/ui';

// Shown when the reports list cannot be loaded (e.g. the database is
// unreachable). No detail is shown — it is logged on the server.
export default function ReportsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PageHeader eyebrow="Reports" title="Reports" />
      <Panel>
        <Stack $gap={16}>
          <Alert tone="error">The reports could not be loaded. This is usually temporary.</Alert>
          <div>
            <Button type="button" onClick={reset}>
              Try again
            </Button>
          </div>
        </Stack>
      </Panel>
    </>
  );
}
