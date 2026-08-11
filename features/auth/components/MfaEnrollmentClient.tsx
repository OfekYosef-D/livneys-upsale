'use client';

import { useState, useTransition } from 'react';
import { confirmMfaEnrollmentAction, startMfaEnrollmentAction } from '../actions';
import { getMfaEnrollmentCopy } from './mfa-enrollment-copy';

export function MfaEnrollmentClient({ alreadyEnabled }: { alreadyEnabled: boolean }) {
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const copy = getMfaEnrollmentCopy(alreadyEnabled);

  return (
    <div className="space-y-4">
      {codes.length === 0 && (
        <div className={`rounded-xl p-4 ${alreadyEnabled ? 'bg-emerald-50 text-emerald-950' : 'bg-amber-50 text-amber-950'}`}>
          <p className="text-sm font-black">{copy.title}</p>
          <p className="mt-1 text-xs font-bold leading-5">{copy.description}</p>
        </div>
      )}
      {!secret && codes.length === 0 && (
        alreadyEnabled ? (
          <form
            className="space-y-3 rounded-xl border border-black/10 bg-black/[0.025] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const password = new FormData(event.currentTarget).get('password');
              startTransition(async () => {
                const result = await startMfaEnrollmentAction({ intent: 'start', password });
                if (result.ok) { setSecret(result.data.secret); setUri(result.data.uri); setMessage(''); }
                else setMessage(result.error);
              });
            }}
          >
            <div>
              <label htmlFor="mfa-current-password" className="block text-xs font-black">אימות סיסמה לפני החלפת MFA</label>
              <p className="mt-1 text-xs font-bold leading-5 text-black/55">הזינו את הסיסמה הנוכחית. כך ניתן לתקן או להחליף את אפליקציית האימות גם כשהגורם הקיים אינו זמין.</p>
            </div>
            <input
              id="mfa-current-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-xl border border-black/12 bg-white px-3 text-sm font-bold outline-none focus:border-black/35 focus:ring-2 focus:ring-black/10"
            />
            <button disabled={pending} className="min-h-11 w-full rounded-full bg-black px-5 text-sm font-black text-white disabled:bg-black/30">
              {pending ? 'מאמתים...' : copy.button}
            </button>
          </form>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => {
              const result = await startMfaEnrollmentAction({ intent: 'start' });
              if (result.ok) { setSecret(result.data.secret); setUri(result.data.uri); setMessage(''); }
              else setMessage(result.error);
            })}
            className="min-h-11 rounded-full bg-black px-5 text-sm font-black text-white disabled:bg-black/30"
          >
            {copy.button}
          </button>
        )
      )}

      {secret && codes.length === 0 && (
        <>
          <div className="rounded-xl border border-black/10 bg-[#e6e1d8] p-4">
            <p className="text-sm font-black">1. הוסיפו חשבון באפליקציית אימות</p>
            <p className="mt-2 break-all font-mono text-sm" dir="ltr">{secret}</p>
            <details className="mt-2 text-xs"><summary className="cursor-pointer font-black">קישור הגדרה מלא</summary><p className="mt-1 break-all font-mono" dir="ltr">{uri}</p></details>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            const code = new FormData(event.currentTarget).get('code');
            startTransition(async () => {
              const result = await confirmMfaEnrollmentAction({ code });
              if (result.ok) { setCodes(result.data.recoveryCodes); setMessage(''); }
              else setMessage(result.error);
            });
          }} className="space-y-2">
            <label className="block"><span className="mb-1 block text-xs font-black">2. הזינו קוד בן 6 ספרות</span><input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required className="h-11 w-full rounded-xl border border-black/12 px-3 text-center text-lg font-black tracking-[.35em]" dir="ltr" /></label>
            <button disabled={pending} className="min-h-11 w-full rounded-full bg-black px-5 text-sm font-black text-white disabled:bg-black/30">אישור והפעלת MFA</button>
          </form>
        </>
      )}

      {codes.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-black">קודי שחזור — מוצגים פעם אחת</h2>
          <p className="mt-1 text-sm font-bold">שמרו אותם במקום בטוח. כל קוד ניתן לשימוש פעם אחת.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2" dir="ltr">{codes.map((code) => <li key={code} className="rounded bg-white p-2 text-center font-mono font-bold">{code}</li>)}</ul>
          <a href="/login?next=/admin" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-black px-4 text-sm font-black text-white">כניסה מחדש למערכת</a>
        </div>
      )}

      {message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-black text-red-800">{message}</p>}
    </div>
  );
}
