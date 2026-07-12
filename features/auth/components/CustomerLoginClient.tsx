'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowLeft, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { brand } from '@/lib/brand';
import { brandLogo } from '@/lib/product-assets';
import type { CustomerLoginOption } from '@/features/auth/queries';

export function CustomerLoginClient({ customers }: { customers: CustomerLoginOption[] }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? customers[0],
    [customerId, customers],
  );
  const [email, setEmail] = useState(selectedCustomer?.email ?? '');
  const [password, setPassword] = useState('livneys-demo');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function selectCustomer(nextCustomerId: string) {
    const nextCustomer = customers.find((customer) => customer.id === nextCustomerId);
    setCustomerId(nextCustomerId);
    setEmail(nextCustomer?.email ?? '');
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setIsSubmitting(false);

    if (!result?.ok) {
      setError('פרטי ההתחברות אינם תקינים.');
      return;
    }

    router.push(`/customer/${customerId}`);
    router.refresh();
  }

  return (
    <main className="app-surface min-h-screen px-3 py-4 text-black md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-md items-center">
        <section className="space-y-5">
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_55px_rgba(0,0,0,0.07)] md:p-5">
            <div className="flex items-center justify-between gap-4">
              <Image src={brandLogo} alt={brand.hebrewName} className="w-28" priority />
              <span className="rounded-full bg-[#e6e1d8] px-3 py-1 text-xs font-black">B2B</span>
            </div>
            <div className="mt-5">
              <p className="text-xs font-black text-black/50">כניסה ללקוחות עסקיים</p>
              <h1 className="mt-1 text-2xl font-black leading-tight md:text-3xl">הזמנה חוזרת לעסק</h1>
              <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-black/62">
                {brand.hebrewTagline}. התחברו וממשיכים ישר לקטלוג.
              </p>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-black">התחברות לדוגמה</span>
                <select
                  name="company"
                  value={customerId}
                  onChange={(event) => selectCustomer(event.target.value)}
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
                  <span className="mb-1.5 block text-xs font-black">אימייל</span>
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 transition focus-within:ring-2 focus-within:ring-black/25">
                    <UserRound size={16} />
                    <input
                      name="email"
                      autoComplete="username"
                      spellCheck={false}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
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

              <Button type="submit" className="w-full" disabled={isSubmitting || customers.length === 0}>
                {isSubmitting ? 'מתחברים...' : 'כניסה לקטלוג'}
                <ArrowLeft size={16} />
              </Button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
