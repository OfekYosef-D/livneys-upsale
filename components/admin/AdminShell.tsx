import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';
import { brandLogo } from '@/lib/product-assets';

const navItems = [
  { href: '/admin', label: 'דשבורד' },
  { href: '/admin/manual-order', label: 'הזמנה ידנית' },
  { href: '/customer/cust-001', label: 'תצוגת לקוח' },
];

export function AdminShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <main className="min-h-screen bg-[#f7f5f1] text-black">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6e1d8]">
              <Image src={brandLogo} alt="Livney's" className="w-8" priority />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">CRM Livney&apos;s</p>
              <p className="truncate text-xs font-bold text-black/50">ניהול הזמנות, מעקב לקוחות ואפסייל</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 text-xs font-black text-black/65 hover:bg-[#e6e1d8] focus-visible:ring-2 focus-visible:ring-black/25">
                {item.label}
              </Link>
            ))}
          </nav>
          <AdminLogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5">
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
