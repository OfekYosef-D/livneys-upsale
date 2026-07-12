import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';
import { brandLogo } from '@/lib/product-assets';

const navItems = [
  { href: '/admin', label: 'לוח עבודה' },
  { href: '/admin/manual-order', label: 'הזמנה ידנית' },
  { href: '/admin/customers', label: 'לקוחות' },
  { href: '/admin/registrations', label: 'הרשמות' },
  { href: '/admin/routes', label: 'קווים' },
  { href: '/admin/notifications', label: 'הודעות' },
  { href: '/admin/products', label: 'מוצרים' },
  { href: '/admin/price-lists', label: 'מחירונים' },
  { href: '/admin/promotions', label: 'מבצעים' },
  { href: '/admin/recommendations', label: 'המלצות' },
];

export function AdminShell({ children, title, subtitle, activeHref }: { children: React.ReactNode; title: string; subtitle?: string; activeHref?: string }) {
  const isActive = (href: string) => activeHref === href || (href !== '/admin' && Boolean(activeHref?.startsWith(`${href}/`)));

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f5f1] text-black">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e6e1d8]">
              <Image src={brandLogo} alt="Livney's" className="w-8" priority />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">CRM Livney&apos;s</p>
              <p className="truncate text-xs font-bold text-black/50">הזמנות B2B, לקוחות, קווי חלוקה והמלצות מכירה</p>
            </div>
          </div>
          <nav className="no-scrollbar hidden max-w-[52rem] items-center gap-1 overflow-x-auto lg:flex">
            {navItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-black focus-visible:ring-2 focus-visible:ring-black/25 ${active ? 'bg-black text-white' : 'text-black/65 hover:bg-[#e6e1d8]'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <AdminLogoutButton />
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-1 border-t border-black/10 px-3 py-2 lg:hidden" aria-label="Admin navigation">
          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-black focus-visible:ring-2 focus-visible:ring-black/25 ${active ? 'bg-black text-white' : 'bg-[#f7f5f1] text-black/70 hover:bg-[#e6e1d8]'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-5">
        <div className="mb-4 flex flex-col gap-1 border-b border-black/10 pb-4">
          <p className="text-xs font-black text-black/45">אזור צוות</p>
          <h1 className="text-2xl font-black md:text-3xl">{title}</h1>
          {subtitle && <p className="max-w-2xl text-sm font-bold leading-6 text-black/58">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
