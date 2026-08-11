'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';
import { inviteCustomerUserAction, resendCustomerUserSetupAction, setCustomerUserActiveAction } from '../actions';
import { completeSuccessfulInvite } from './customer-users-manager-helpers';

type Account = { id: string; name: string; email: string; isActive: boolean; setupComplete: boolean };

export function CustomerUsersManager({ customerId, accounts }: { customerId: string; accounts: Account[] }) {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
      <h2 className="text-base font-black">משתמשי החברה</h2>
      <ul className="mt-2 space-y-2">
        {accounts.map((account) => (
          <li key={account.id} className="rounded-xl bg-[#e6e1d8] p-3 text-sm">
            <p className="font-black">{account.name}</p>
            <p className="break-all font-bold text-black/60" dir="ltr">{account.email}</p>
            <p className="mt-1 text-xs font-black">{!account.isActive ? 'מושבת' : account.setupComplete ? 'פעיל' : 'ממתין להגדרת סיסמה'}</p>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => {
                const result = await setCustomerUserActiveAction({ customerId, userId: account.id, isActive: !account.isActive });
                setMessage(result.ok ? (account.isActive ? 'המשתמש הושבת וכל החיבורים שלו בוטלו.' : 'המשתמש הופעל מחדש.') : result.error);
                if (result.ok) router.refresh();
              })}
              className="mt-2 text-xs font-black underline underline-offset-4"
            >
              {account.isActive ? 'השבתת משתמש' : 'הפעלת משתמש'}
            </button>
            {account.isActive && !account.setupComplete && (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  const result = await resendCustomerUserSetupAction({ customerId, userId: account.id });
                  setMessage(result.ok ? 'נשלח קישור מאובטח חדש.' : result.error);
                })}
                className="mt-2 mr-3 text-xs font-black underline underline-offset-4"
              >
                שליחת קישור מחדש
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        startTransition(async () => {
          const result = await inviteCustomerUserAction({ customerId, name: values.get('name'), email: values.get('email') });
          if (result.ok) {
            setMessage('המשתמש נוסף ונשלח אליו קישור להגדרת סיסמה.');
            completeSuccessfulInvite(form, router);
          }
          else setMessage(result.error);
        });
      }} className="mt-4 space-y-2 border-t border-black/10 pt-4">
        <p className="text-xs font-black">הוספת משתמש מורשה נוסף</p>
        <input name="name" required placeholder="שם מלא" className={fieldClass} />
        <input name="email" type="email" required placeholder="אימייל" autoComplete="off" className={fieldClass} dir="ltr" />
        <button disabled={pending} className="min-h-10 w-full rounded-full bg-black px-4 text-xs font-black text-white disabled:bg-black/30">{pending ? 'שולחים...' : 'הוספה ושליחת קישור'}</button>
        {message && <p role="status" className="rounded-xl bg-white p-2 text-xs font-bold">{message}</p>}
      </form>
    </section>
  );
}

const fieldClass = 'h-10 w-full rounded-xl border border-black/12 bg-white px-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-black/25';
