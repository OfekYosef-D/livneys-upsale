'use client';

import Image from 'next/image';
import Link, { useLinkStatus } from 'next/link';
import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { Spinner } from '@/components/ui/Spinner';
import { brandLogo } from '@/lib/product-assets';

const navGroups = [
  {
    label: 'תפעול',
    items: [
      { href: '/admin', label: 'לוח עבודה' },
      { href: '/admin/manual-order', label: 'הזמנה ידנית' },
      { href: '/admin/customers', label: 'לקוחות' },
      { href: '/admin/registrations', label: 'בקשות הצטרפות' },
      { href: '/admin/routes', label: 'קווי חלוקה' },
      { href: '/admin/notifications', label: 'הודעות ותזכורות' },
    ],
  },
  {
    label: 'קטלוג',
    items: [
      { href: '/admin/products', label: 'מוצרים' },
      { href: '/admin/price-lists', label: 'מחירונים' },
      { href: '/admin/promotions', label: 'מבצעים' },
      { href: '/admin/recommendations', label: 'המלצות ללקוחות' },
    ],
  },
  {
    label: 'מערכת',
    items: [
      { href: '/admin/audit', label: 'יומן פעולות' },
      { href: '/admin/security/mfa', label: 'אבטחת החשבון' },
    ],
  },
];

function isActiveHref(activeHref: string | undefined, href: string) {
  return activeHref === href || (href !== '/admin' && Boolean(activeHref?.startsWith(`${href}/`)));
}

function NavLinks({ activeHref, onNavigate }: { activeHref?: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5" aria-label="Admin navigation">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-[11px] font-medium text-black/60">{group.label}</p>
          <ul className="mt-1 space-y-0.5">
            {group.items.map((item) => {
              const active = isActiveHref(activeHref, item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                    className={`block rounded px-3 py-1.5 text-[13px] focus-visible:ring-2 focus-visible:ring-black/20 ${
                      active ? 'bg-[var(--pantry)] font-medium text-black' : 'font-medium text-black/62 hover:bg-[var(--pantry-soft)] hover:text-black'
                    }`}
                  >
                    <NavItemLabel>{item.label}</NavItemLabel>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavItemLabel({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();

  return (
    <span className="flex items-center justify-between gap-2">
      <span>{children}</span>
      {pending ? <Spinner size={12} /> : null}
    </span>
  );
}

export function AdminShell({ children, title, subtitle, activeHref }: { children: ReactNode; title: string; subtitle?: string; activeHref?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--pantry-soft)] text-black">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-e border-[var(--pantry-line)] bg-white lg:flex">
          <div className="flex items-center gap-2.5 border-b border-[var(--pantry-line)] px-3 py-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[var(--pantry)]">
              <Image src={brandLogo} alt="Livney's" className="w-6" priority />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">CRM Livney&apos;s</p>
              <p className="truncate text-[11px] text-black/60">הזמנות B2B</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-3">
            <NavLinks activeHref={activeHref} />
          </div>
          <div className="border-t border-[var(--pantry-line)] p-2.5">
            <LogoutButton />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--pantry-line)] bg-white px-3 py-2.5 lg:hidden">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-md hover:bg-[var(--pantry)] focus-visible:ring-2 focus-visible:ring-black/20"
              onClick={() => setOpen(true)}
              aria-label="פתיחת תפריט"
            >
              <Menu size={18} />
            </button>
            <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
            <LogoutButton compact />
          </header>

          {open && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button type="button" className="absolute inset-0 bg-black/35" aria-label="סגירת תפריט" onClick={() => setOpen(false)} />
              <aside className="absolute inset-y-0 right-0 flex w-72 flex-col bg-white shadow-[var(--shadow-dialog)]">
                <div className="flex items-center justify-between border-b border-[var(--pantry-line)] px-4 py-3">
                  <p className="text-sm font-semibold">CRM Livney&apos;s</p>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md hover:bg-[var(--pantry)]"
                    onClick={() => setOpen(false)}
                    aria-label="סגירה"
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-4">
                  <NavLinks activeHref={activeHref} onNavigate={() => setOpen(false)} />
                </div>
                <div className="border-t border-[var(--pantry-line)] p-3">
                  <LogoutButton />
                </div>
              </aside>
            </div>
          )}

          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[90rem] px-4 py-4">
            <div className="mb-3">
              <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-0.5 max-w-3xl text-xs leading-5 text-black/60">{subtitle}</p>}
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
