'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { adminCookieName } from '@/lib/admin-auth';

export function AdminLogoutButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        document.cookie = `${adminCookieName}=; path=/admin; max-age=0; SameSite=Lax`;
        router.push('/admin/login');
      }}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-3 text-xs font-black text-white focus-visible:ring-2 focus-visible:ring-black/30"
    >
      <LogOut size={15} aria-hidden="true" />
      יציאה
    </button>
  );
}
