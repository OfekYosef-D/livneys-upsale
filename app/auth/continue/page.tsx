import { redirect } from 'next/navigation';
import { getValidatedSession } from '@/lib/authorization';
import { sanitizeInternalNextPath } from '@/features/auth/security';

export default async function ContinueAfterLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getValidatedSession();
  if (!session?.user) redirect('/login');

  const query = await searchParams;
  if (session.user.role === 'ADMIN') {
    redirect(sanitizeInternalNextPath(query.next, '/admin'));
  }
  const fallback = session.user.customerId ? `/customer/${session.user.customerId}` : '/login';
  const requested = sanitizeInternalNextPath(query.next, fallback);
  redirect(requested.startsWith('/customer/') ? requested : fallback);
}
