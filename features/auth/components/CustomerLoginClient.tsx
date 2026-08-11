'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowLeft, KeyRound, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { brand } from '@/lib/brand';
import { brandLogo } from '@/lib/product-assets';

export function CustomerLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    const result = await signIn('credentials', { email, password, mfaCode, redirect: false });
    setIsSubmitting(false);
    if (!result?.ok) {
      setError('לא ניתן להתחבר עם הפרטים שהוזנו. בדקו את הפרטים ונסו שוב.');
      return;
    }
    const next = searchParams.get('next');
    router.push(`/auth/continue${next ? `?next=${encodeURIComponent(next)}` : ''}`);
    router.refresh();
  }

  return (
    <main className="app-surface min-h-screen px-3 py-4 text-black md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-md items-center">
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_55px_rgba(0,0,0,0.07)] md:p-5">
          <div className="flex items-center justify-between gap-4">
            <Image src={brandLogo} alt={brand.hebrewName} className="w-28" priority />
            <span className="rounded-full bg-[#e6e1d8] px-3 py-1 text-xs font-black">B2B</span>
          </div>
          <div className="mt-5">
            <p className="text-xs font-black text-black/50">כניסה מאובטחת</p>
            <h1 className="mt-1 text-2xl font-black leading-tight md:text-3xl">החשבון העסקי שלך</h1>
            <p className="mt-2 text-sm font-bold leading-6 text-black/62">אותו מסך משמש לקוחות ומנהלים. פרטי החשבון אינם נחשפים באתר.</p>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <Field icon={<UserRound size={16} />} label="אימייל">
              <input name="email" type="email" autoComplete="username" spellCheck={false} required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" />
            </Field>
            <Field icon={<LockKeyhole size={16} />} label="סיסמה">
              <input name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" />
            </Field>
            <details className="rounded-xl border border-black/10 p-3">
              <summary className="cursor-pointer text-xs font-black text-black/60">קוד אימות למנהלים</summary>
              <div className="mt-3">
                <Field icon={<KeyRound size={16} />} label="קוד מאפליקציית האימות או קוד שחזור">
                  <input name="mfaCode" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" dir="ltr" />
                </Field>
              </div>
            </details>

            {error && <p role="alert" className="rounded-xl bg-[#e6e1d8] p-2.5 text-xs font-black">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'מתחברים...' : 'כניסה לחשבון'} <ArrowLeft size={16} />
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap justify-between gap-3 text-xs font-black">
            <Link href="/forgot-password" className="underline underline-offset-4">שכחתי סיסמה</Link>
            <Link href="/register" className="underline underline-offset-4">בקשת פתיחת חשבון עסקי</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black">{label}</span>
      <span className="flex h-11 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 transition focus-within:ring-2 focus-within:ring-black/25">
        {icon}{children}
      </span>
    </label>
  );
}
