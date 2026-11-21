import type { Metadata } from 'next';
import RequestAccessScreen from '@/components/admin/RequestAccessScreen';

export const metadata: Metadata = { title: 'Request access' };

export default function RequestAccessPage() {
  return <RequestAccessScreen />;
}
