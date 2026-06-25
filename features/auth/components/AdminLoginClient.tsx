'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowLeft, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, Suspense, useState } from 'react';

export function AdminLoginClient() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('admin@livneys.local');
  const [password, setPassword] = useState('livneys-admin');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    router.push(searchParams.get('next') ?? '/admin');
    router.refresh();
  }

  return (
    <main className="app-surface grid min-h-screen place-items-center px-4 py-6 text-black">
      <section className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.08)]">
        <p className="text-xs font-black text-black/45">Livney&apos;s Admin</p>
        <h1 className="mt-1 text-2xl font-black">כניסת צוות</h1>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black">אימייל</span>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 focus-within:ring-2 focus-within:ring-black/25">
              <UserRound size={16} />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-transparent text-sm font-bold outline-none"
                autoComplete="username"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black">סיסמה</span>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 focus-within:ring-2 focus-within:ring-black/25">
              <LockKeyhole size={16} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent text-sm font-bold outline-none"
                autoComplete="current-password"
              />
            </div>
          </label>
          {error && <p className="rounded-xl bg-[#e6e1d8] p-2.5 text-xs font-black">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white disabled:bg-black/30"
          >
            {isSubmitting ? 'מתחברים...' : 'כניסה לניהול'}
            <ArrowLeft size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
