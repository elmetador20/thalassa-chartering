import type { Metadata } from 'next';
import AdminRoot from '@/components/admin/AdminRoot';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s — INCWORX Admin' },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRoot>{children}</AdminRoot>;
}
