import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LoginScreen from '@/components/admin/LoginScreen';
import { safeAdminRedirect, SIGNED_IN_LOGIN_REDIRECT } from '@/lib/auth/constants';
import { getCurrentSession } from '@/lib/server/auth/guards';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string | string[]; activated?: string | string[] } }) {
  // Already signed in (and still valid): skip the form.
  if (await getCurrentSession()) redirect(SIGNED_IN_LOGIN_REDIRECT);

  const next = typeof searchParams.next === 'string' ? safeAdminRedirect(searchParams.next, '') : '';
  return <LoginScreen next={next} activated={searchParams.activated === '1'} />;
}
