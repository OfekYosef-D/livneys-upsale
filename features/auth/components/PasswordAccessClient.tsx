'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { requestPasswordResetAction, setPasswordWithTokenAction } from '../actions';

export function ForgotPasswordClient() {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  return (
    <AuthCard title="איפוס סיסמה" description="נשלח קישור חד-פעמי אם קיים חשבון פעיל עבור הכתובת.">
      <form onSubmit={(event) => {
        event.preventDefault();
        const email = new FormData(event.currentTarget).get('email');
        startTransition(async () => {
          const result = await requestPasswordResetAction({ email });
          setMessage(result.ok ? result.data.message : result.error);
        });
      }} className="space-y-3">
        <Input name="email" label="אימייל" type="email" autoComplete="email" required />
        {message && <p role="status" className="rounded-xl bg-[#e6e1d8] p-3 text-sm font-bold">{message}</p>}
        <SubmitButton pending={pending}>שליחת קישור מאובטח</SubmitButton>
      </form>
    </AuthCard>
  );
}

export function PasswordTokenClient({ token, type }: { token: string; type: 'setup' | 'reset' }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <AuthCard
      title={type === 'setup' ? 'הגדרת סיסמה' : 'בחירת סיסמה חדשה'}
      description="הסיסמה חייבת לכלול לפחות 12 תווים, אות גדולה, אות קטנה, מספר ותו מיוחד."
    >
      {complete ? (
        <div className="space-y-3 rounded-xl bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 />
          <p className="font-black">הסיסמה נשמרה וכל החיבורים הישנים בוטלו.</p>
          <button onClick={() => router.push('/login')} className="font-black underline">מעבר לכניסה</button>
        </div>
      ) : (
        <form onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await setPasswordWithTokenAction({
              token,
              type,
              password: form.get('password'),
              passwordConfirmation: form.get('passwordConfirmation'),
            });
            if (result.ok) setComplete(true);
            else setMessage(result.error);
          });
        }} className="space-y-3">
          <Input name="password" label="סיסמה חדשה" type="password" autoComplete="new-password" required />
          <Input name="passwordConfirmation" label="אימות סיסמה" type="password" autoComplete="new-password" required />
          {message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{message}</p>}
          <SubmitButton pending={pending}>שמירת הסיסמה</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}

function AuthCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="app-surface min-h-screen px-3 py-6 text-black">
      <section className="mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.07)]">
        <p className="text-xs font-black text-black/45">Livney&apos;s B2B</p>
        <h1 className="mt-1 text-2xl font-black">{title}</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-black/60">{description}</p>
        <div className="mt-5">{children}</div>
        <Link href="/login" className="mt-4 inline-flex items-center gap-1 text-xs font-black underline">חזרה לכניסה <ArrowLeft size={14} /></Link>
      </section>
    </main>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return <label className="block"><span className="mb-1 block text-xs font-black">{label}</span><input {...inputProps} className="h-11 w-full rounded-xl border border-black/12 px-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-black/25" /></label>;
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return <button disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white disabled:bg-black/30">{pending ? 'מבצעים...' : children}</button>;
}
