import type { Metadata } from 'next';
import AdminRoot from '@/components/admin/AdminRoot';

// Signed-out account screens outside /admin (so the admin middleware's
// cookie redirect does not apply): Request Access and invitation acceptance.
// Same light admin surface as the sign-in page; never indexed.
export const metadata: Metadata = {
  title: { default: 'Access', template: '%s — INCWORX Admin' },
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return <AdminRoot>{children}</AdminRoot>;
}
