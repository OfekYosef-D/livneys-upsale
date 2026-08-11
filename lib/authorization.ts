import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from './db';
import { sanitizeInternalNextPath } from '../features/auth/security';

export class AuthorizationError extends Error {
  constructor(message = 'אין הרשאה לבצע פעולה זו.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function getValidatedSession() {
  const session = await getCurrentSession();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { customer: { select: { id: true, isActive: true } } },
  });
  if (
    !user
    || !user.isActive
    || user.role !== session.user.role
    || user.customerId !== session.user.customerId
    || user.sessionVersion !== session.user.sessionVersion
    || (user.role === 'CUSTOMER' && (!user.customerId || !user.customer?.isActive))
  ) return null;

  session.user.mfaEnabled = user.mfaEnabled;
  return session;
}

export async function requireAdminPage(nextPath: string) {
  const session = await getValidatedSession();

  if (!session?.user) {
    const safeNext = sanitizeInternalNextPath(nextPath, '/admin');
    redirect(`/login?next=${encodeURIComponent(safeNext)}`);
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  if (!session.user.mfaEnabled && nextPath !== '/admin/security/mfa') {
    redirect('/admin/security/mfa');
  }

  return session;
}

export async function requireCustomerPage(customerId: string) {
  const session = await getValidatedSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role === 'ADMIN') {
    if (!session.user.mfaEnabled) redirect('/admin/security/mfa');
    return session;
  }

  if (session.user.customerId !== customerId) {
    redirect(session.user.customerId ? `/customer/${session.user.customerId}` : '/login');
  }

  return session;
}

export async function assertAdminAction() {
  const session = await getValidatedSession();

  if (!session?.user || session.user.role !== 'ADMIN' || !session.user.mfaEnabled) {
    throw new AuthorizationError();
  }

  return session;
}

export async function assertCustomerAction(customerId: string) {
  const session = await getValidatedSession();

  if (!session?.user) {
    throw new AuthorizationError();
  }

  if (session.user.role !== 'CUSTOMER' || session.user.customerId !== customerId) {
    throw new AuthorizationError('אין גישה לחשבון לקוח אחר.');
  }

  return session;
}

export async function assertAdminEnrollmentAction() {
  const session = await getValidatedSession();
  if (!session?.user || session.user.role !== 'ADMIN') throw new AuthorizationError();
  return session;
}
