import Image from 'next/image';
import type { ReactNode } from 'react';
import { brandLogo } from '@/lib/product-assets';
import { LogoutButton } from '@/features/auth/components/LogoutButton';

/** Sticky portal header: who is ordering, for which delivery, and a way out. */
export function CustomerHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 px-3 py-2.5 backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--pantry)]">
            <Image src={brandLogo} alt="ליבני'ס" className="w-8" priority />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            {subtitle && <p className="truncate text-xs text-black/55">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <LogoutButton compact />
        </div>
      </div>
    </header>
  );
}
