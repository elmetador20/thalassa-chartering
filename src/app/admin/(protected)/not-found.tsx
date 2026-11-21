import Link from 'next/link';
import { Muted, PageHeader, Panel } from '@/components/admin/ui';

export default function AdminNotFound() {
  return (
    <>
      <PageHeader eyebrow="Not available" title="This page isn't available" />
      <Panel>
        <Muted>
          It doesn&apos;t exist, or your role doesn&apos;t include access to it. <Link href="/admin">Back to the dashboard</Link>
        </Muted>
      </Panel>
    </>
  );
}
