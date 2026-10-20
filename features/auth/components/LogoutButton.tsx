'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: '/login' });
      }}
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label="יציאה מהחשבון"
      title="יציאה"
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium text-black/65 hover:bg-[var(--pantry)] hover:text-black focus-visible:ring-2 focus-visible:ring-black/20 ${compact ? 'w-10' : 'w-full px-3'}`}
    >
      {pending ? <Spinner size={15} /> : <LogOut size={16} aria-hidden="true" />}
      {!compact && (pending ? 'יוצאים…' : 'יציאה')}
    </button>
  );
}
