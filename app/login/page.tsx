'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { brand, mockCredentials } from '@/lib/brand';
import { customers } from '@/lib/mock-data';
import { brandLogo } from '@/lib/product-assets';

export default function LoginPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0].id);
  const [username, setUsername] = useState(mockCredentials.username);
  const [password, setPassword] = useState(mockCredentials.password);
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError('מלאו שם משתמש וסיסמה כדי להמשיך לדמו.');
      return;
    }

    router.push(`/customer/${customerId}`);
  }

  return (
    <main className="app-surface min-h-screen px-3 py-4 text-black md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-md items-center">
        <section className="space-y-5">
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_55px_rgba(0,0,0,0.07)] md:p-5">
            <div className="flex items-center justify-between gap-4">
              <Image src={brandLogo} alt="Livney's" className="w-28" priority />
              <span className="rounded-full bg-[#e6e1d8] px-3 py-1 text-xs font-black">B2B</span>
            </div>
            <div className="mt-5">
              <p className="text-xs font-black text-black/50">כניסה ללקוחות עסקיים</p>
              <h1 className="mt-1 text-2xl font-black leading-tight md:text-3xl">הזמנה חוזרת לעסק</h1>
              <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-black/62">{brand.hebrewTagline}. התחברו וממשיכים ישר לקטלוג.</p>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black">חברה לדמו</span>
                <select
                  name="company"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  autoComplete="organization"
                  className="h-11 w-full rounded-xl border border-black/12 bg-white px-3 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-black/25"
                >
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} · {customer.region}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black">שם משתמש</span>
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 transition focus-within:ring-2 focus-within:ring-black/25">
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
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 transition focus-within:ring-2 focus-within:ring-black/25">
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
              </div>

              {error && <p className="rounded-xl bg-[#e6e1d8] p-2.5 text-xs font-black">{error}</p>}

              <Button type="submit" className="w-full">
                כניסה לקטלוג
                <ArrowLeft size={16} />
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
