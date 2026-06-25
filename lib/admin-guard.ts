import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminCookieName } from '@/lib/admin-auth';

export function requireAdmin(nextPath: string) {
  const isAdmin = cookies().get(adminCookieName)?.value === '1';

  if (!isAdmin) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
}
