'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { formValue, TextField } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { requestPasswordResetAction, setPasswordWithTokenAction } from '../actions';
import { PASSWORD_HINT } from '../password-policy';

/** Without email delivery the team sends reset links by WhatsApp, so the page says whom to ask. */
export function ForgotPasswordClient({ emailEnabled }: { emailEnabled: boolean }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!emailEnabled) {
    return (
      <AuthCard title="שכחתי סיסמה" description="פנו לצוות ליבני'ס (בוואטסאפ או בטלפון) ונשלח אליכם קישור אישי לבחירת סיסמה חדשה.">
        <Link href="/login" className="text-sm font-semibold underline underline-offset-4">חזרה לכניסה</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="שכחתי סיסמה" description="נשלח אליכם במייל קישור לבחירת סיסמה חדשה.">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const email = formValue.text(new FormData(event.currentTarget), 'email');
          startTransition(async () => {
            const result = await requestPasswordResetAction({ email });
            setMessage(result.ok ? { ok: true, text: result.data.message } : { ok: false, text: result.error });
          });
        }}
      >
        <TextField name="email" label="אימייל" type="email" dir="ltr" autoComplete="email" required />
        {message && <Notice tone={message.ok ? 'success' : 'danger'}>{message.text}</Notice>}
        <Button type="submit" fullWidth pending={pending} pendingLabel="שולחים…">שליחת קישור</Button>
      </form>
    </AuthCard>
  );
}

export function PasswordTokenClient({ token, type }: { token: string; type: 'setup' | 'reset' }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AuthCard title={type === 'setup' ? 'ברוכים הבאים! בחרו סיסמה' : 'בחירת סיסמה חדשה'} description={PASSWORD_HINT}>
      {done ? (
        <Notice tone="success" icon={<CheckCircle2 size={18} />} title="הסיסמה נשמרה">
          <Link href="/login" className="font-semibold underline">כניסה לחשבון</Link>
        </Notice>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await setPasswordWithTokenAction({
                token,
                type,
                password: formValue.text(form, 'password'),
                passwordConfirmation: formValue.text(form, 'passwordConfirmation'),
              });
              if (result.ok) setDone(true);
              else setError(result.error);
            });
          }}
        >
          <TextField name="password" label="סיסמה" type="password" autoComplete="new-password" required minLength={10} />
          <TextField name="passwordConfirmation" label="הקלדה חוזרת של הסיסמה" type="password" autoComplete="new-password" required />
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" fullWidth pending={pending} pendingLabel="שומרים…">שמירת הסיסמה</Button>
        </form>
      )}
    </AuthCard>
  );
}

function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="app-surface grid min-h-screen place-items-center px-3 py-6 text-black">
      <section className="ui-panel w-full max-w-md p-5">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-black/60">{description}</p>
        <div className="mt-5">{children}</div>
        <Link href="/login" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold underline">חזרה לכניסה <ArrowLeft size={14} /></Link>
      </section>
    </main>
  );
}
