import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export class AuthorizationError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function requireAdminPage(nextPath: string) {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  return session;
}

export async function requireCustomerPage(customerId: string) {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role === 'ADMIN') {
    return session;
  }

  if (session.user.customerId !== customerId) {
    redirect(session.user.customerId ? `/customer/${session.user.customerId}` : '/login');
  }

  return session;
}

export async function assertAdminAction() {
  const session = await getCurrentSession();

  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new AuthorizationError();
  }

  return session;
}

export async function assertCustomerAction(customerId: string) {
  const session = await getCurrentSession();

  if (!session?.user) {
    throw new AuthorizationError();
  }

  if (session.user.role !== 'CUSTOMER' || session.user.customerId !== customerId) {
    throw new AuthorizationError('Cannot access another customer account');
  }

  return session;
}
