import { redirect } from 'next/navigation';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './db';
import { AuthorizationError } from './errors';
import { sanitizeInternalNextPath } from '@/features/auth/security';

export { AuthorizationError };

export type AuthenticatedSession = Session & { user: NonNullable<Session['user']> };

/**
 * The JWT alone is not trusted: the user row is re-read on every request so that
 * deactivation, role changes and password resets (sessionVersion) take effect immediately.
 */
export async function getValidatedSession(): Promise<AuthenticatedSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { customer: { select: { isActive: true } } },
  });
  const isValid = user
    && user.isActive
    && user.role === session.user.role
    && user.customerId === session.user.customerId
    && user.sessionVersion === session.user.sessionVersion
    && (user.role !== 'CUSTOMER' || Boolean(user.customerId && user.customer?.isActive));
  if (!isValid) return null;

  session.user.mfaEnabled = user.mfaEnabled;
  return session as AuthenticatedSession;
}

export async function requireAdminPage(nextPath: string): Promise<AuthenticatedSession> {
  const session = await getValidatedSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(sanitizeInternalNextPath(nextPath, '/admin'))}`);
  if (session.user.role !== 'ADMIN') redirect('/login');
  return session;
}

export async function requireCustomerPage(customerId: string): Promise<AuthenticatedSession> {
  const session = await getValidatedSession();
  if (!session) redirect('/login');
  if (session.user.role === 'ADMIN') return session;
  if (session.user.customerId !== customerId) {
    redirect(session.user.customerId ? `/customer/${session.user.customerId}` : '/login');
  }
  return session;
}

export async function assertAdminAction(): Promise<AuthenticatedSession> {
  const session = await getValidatedSession();
  if (session?.user.role !== 'ADMIN') throw new AuthorizationError();
  return session;
}

export async function assertCustomerAction(customerId: string): Promise<AuthenticatedSession> {
  const session = await getValidatedSession();
  if (!session) throw new AuthorizationError();
  if (session.user.role !== 'CUSTOMER' || session.user.customerId !== customerId) {
    throw new AuthorizationError('אין גישה לחשבון לקוח אחר.');
  }
  return session;
}
