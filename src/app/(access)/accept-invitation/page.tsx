import type { Metadata } from 'next';
import AcceptInvitationScreen from '@/components/admin/AcceptInvitationScreen';

export const metadata: Metadata = { title: 'Set up your account' };

// The token is in the URL fragment, read in the browser — this page itself is
// static and carries no secret.
export default function AcceptInvitationPage() {
  return <AcceptInvitationScreen />;
}
