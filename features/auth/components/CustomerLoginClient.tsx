'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { formValue, TextField } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { brandLogo } from '@/lib/product-assets';

export function CustomerLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);

    const result = await signIn('credentials', {
      email: formValue.text(form, 'email'),
      password: formValue.text(form, 'password'),
      mfaCode: formValue.text(form, 'mfaCode'),
      redirect: false,
    });
    if (!result?.ok) {
      setPending(false);
      // Expected errors (e.g. too many attempts) arrive as Hebrew messages; anything else stays generic.
      setError(result?.error && result.error !== 'CredentialsSignin' && /[֐-׿]/.test(result.error)
        ? result.error
        : 'האימייל או הסיסמה שגויים. בדקו ונסו שוב.');
      return;
    }

    const next = searchParams.get('next');
    router.push(`/auth/continue${next ? `?next=${encodeURIComponent(next)}` : ''}`);
    router.refresh();
  }

  return (
    <main id="main-content" tabIndex={-1} className="app-surface grid min-h-screen place-items-center px-3 py-6 text-black">
      <section className="ui-panel w-full max-w-sm p-5">
        <Image src={brandLogo} alt="ליבני'ס" className="w-24" priority />
        <h1 className="mt-5 text-xl font-semibold">כניסה להזמנות</h1>
        <p className="mt-1 text-sm text-black/60">הזמנה שבועית לעסקים – מהירה, עם ההזמנה הקודמת שלכם מוכנה בסל.</p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <TextField name="email" label="אימייל" type="email" dir="ltr" autoComplete="username" required />
          <TextField name="password" label="סיסמה" type="password" autoComplete="current-password" required />
          <details>
            <summary className="cursor-pointer text-xs text-black/60">יש לי קוד אימות (מנהלים)</summary>
            <TextField name="mfaCode" label="קוד מאפליקציית האימות או קוד שחזור" dir="ltr" autoComplete="one-time-code" className="mt-2" />
          </details>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" fullWidth size="lg" pending={pending} pendingLabel="נכנסים…">
            כניסה <ArrowLeft size={16} aria-hidden="true" />
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap justify-between gap-3 text-xs font-medium">
          <Link href="/forgot-password" className="underline underline-offset-4">שכחתי סיסמה</Link>
          <Link href="/register" className="underline underline-offset-4">עסק חדש? פתיחת חשבון</Link>
        </div>
      </section>
    </main>
  );
}
