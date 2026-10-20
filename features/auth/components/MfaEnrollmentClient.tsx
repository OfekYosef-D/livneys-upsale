'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { formValue, TextField } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';
import { confirmMfaEnrollmentAction, startMfaEnrollmentAction } from '../actions';

/** Optional authenticator-app 2FA for admins: start → scan/enter secret → confirm code → save recovery codes. */
export function MfaEnrollmentClient({ alreadyEnabled }: { alreadyEnabled: boolean }) {
  const [enrollment, setEnrollment] = useState<{ secret: string; uri: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start(password = '') {
    startTransition(async () => {
      const result = await startMfaEnrollmentAction({ password });
      if (result.ok) {
        setEnrollment(result.data);
        setError(null);
      } else setError(result.error);
    });
  }

  if (recoveryCodes.length > 0) {
    return (
      <div className="space-y-3">
        <Notice tone="warning" title="קודי שחזור – מוצגים פעם אחת בלבד">שמרו אותם במקום בטוח. כל קוד מאפשר כניסה אחת אם הטלפון לא זמין.</Notice>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm" dir="ltr">
          {recoveryCodes.map((code) => <li key={code} className="rounded bg-[var(--pantry-soft)] p-2 text-center">{code}</li>)}
        </ul>
        <Button href="/login?next=/admin" fullWidth>כניסה מחדש</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Notice tone={alreadyEnabled ? 'success' : 'info'} title={alreadyEnabled ? 'אימות דו-שלבי פעיל' : 'אימות דו-שלבי (מומלץ)'}>
        {alreadyEnabled
          ? 'אפשר להחליף את אפליקציית האימות. ההגנה הקיימת נשארת פעילה עד לאישור החדשה.'
          : 'מוסיף שכבת הגנה לחשבון המנהל: בכל כניסה תתבקשו גם קוד מאפליקציה כמו Google Authenticator.'}
      </Notice>

      {!enrollment && (alreadyEnabled ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            start(formValue.text(new FormData(event.currentTarget), 'password'));
          }}
        >
          <TextField name="password" label="הסיסמה הנוכחית" type="password" autoComplete="current-password" required />
          <Button type="submit" fullWidth pending={pending}>החלפת אפליקציית אימות</Button>
        </form>
      ) : (
        <Button fullWidth pending={pending} onClick={() => start()}>הפעלת אימות דו-שלבי</Button>
      ))}

      {enrollment && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const code = formValue.text(new FormData(event.currentTarget), 'code');
            startTransition(async () => {
              const result = await confirmMfaEnrollmentAction({ code });
              if (result.ok) setRecoveryCodes(result.data.recoveryCodes);
              else setError(result.error);
            });
          }}
        >
          <div className="rounded-md bg-[var(--pantry-soft)] p-3 text-sm">
            <p className="font-semibold">1. הוסיפו חשבון באפליקציית האימות עם המפתח:</p>
            <p className="mt-2 break-all font-mono" dir="ltr">{enrollment.secret}</p>
            <details className="mt-2 text-xs"><summary className="cursor-pointer">קישור הגדרה מלא</summary><p className="mt-1 break-all font-mono" dir="ltr">{enrollment.uri}</p></details>
          </div>
          <TextField name="code" label="2. הקלידו את הקוד בן 6 הספרות" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" dir="ltr" required />
          <Button type="submit" fullWidth pending={pending}>אישור והפעלה</Button>
        </form>
      )}

      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
