import { Muted, PageHeader, Panel } from '@/components/admin/ui';

export default function ReportsLoading() {
  return (
    <>
      <PageHeader eyebrow="Reports" title="Reports" />
      <Panel aria-busy="true">
        <Muted role="status">Loading reports…</Muted>
      </Panel>
    </>
  );
}
