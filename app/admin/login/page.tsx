import { redirect } from 'next/navigation';
import { sanitizeInternalNextPath } from '@/features/auth/security';

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  const next = sanitizeInternalNextPath(query.next, '/admin');
  redirect(`/login?next=${encodeURIComponent(next)}`);
}
