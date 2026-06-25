'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, Suspense, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { adminCookieName, adminCredentials } from '@/lib/admin-auth';
import { brandLogo } from '@/lib/product-assets';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState(adminCredentials.username);
  const [password, setPassword] = useState(adminCredentials.password);
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (username !== adminCredentials.username || password !== adminCredentials.password) {
      setError('בדמו: השתמשו ב-admin / livneys.');
      return;
    }

    document.cookie = `${adminCookieName}=1; path=/admin; max-age=604800; SameSite=Lax`;
    router.push(searchParams.get('next') ?? '/admin');
  }

  return (
    <main className="app-surface grid min-h-screen place-items-center px-4 py-6 text-black">
      <section className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.08)]">
        <Image src={brandLogo} alt="Livney's" className="w-28" priority />
        <p className="mt-6 text-xs font-black text-black/45">כניסת צוות</p>
        <h1 className="mt-1 text-2xl font-black">CRM Livney&apos;s</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-black/60">אזור תפעולי להזמנות, מעקב לקוחות והזדמנויות מכירה.</p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black">שם משתמש</span>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 focus-within:ring-2 focus-within:ring-black/25">
              <UserRound size={16} />
              <input
                name="username"
                autoComplete="username"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full bg-transparent text-sm font-bold outline-none"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black">סיסמה</span>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 focus-within:ring-2 focus-within:ring-black/25">
              <LockKeyhole size={16} />
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-sm font-bold outline-none"
              />
            </div>
          </label>

          {error && <p className="rounded-xl bg-[#e6e1d8] p-2.5 text-xs font-black">{error}</p>}

          <Button type="submit" className="w-full">
            כניסה ל-CRM
          </Button>
        </form>
      </section>
    </main>
  );
}
