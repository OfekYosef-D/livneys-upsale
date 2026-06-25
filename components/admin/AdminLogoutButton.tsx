'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export function AdminLogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/admin/login' })}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-3 text-xs font-black text-white focus-visible:ring-2 focus-visible:ring-black/30"
    >
      <LogOut size={15} aria-hidden="true" />
      יציאה
    </button>
  );
}
