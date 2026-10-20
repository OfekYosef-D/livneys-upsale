'use client';

import { UserPlus } from 'lucide-react';
import { useServerAction } from '@/components/hooks/useServerAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formValue, TextField } from '@/components/ui/Field';
import { ActionFeedback } from '@/components/ui/Notice';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { inviteCustomerUserAction, resendCustomerUserSetupAction, setCustomerUserActiveAction } from '../actions';

type Account = { id: string; name: string; email: string; isActive: boolean; setupComplete: boolean };

/** Login accounts of one company. Invites are emailed as one-time links; the team never sees passwords. */
export function CustomerUsersManager({ customerId, accounts }: { customerId: string; accounts: Account[] }) {
  const action = useServerAction();

  return (
    <Panel>
      <PanelHeader title="משתמשים עם גישה" description="כל משתמש מקבל קישור אישי להגדרת סיסמה במייל." />
      <ul className="divide-y divide-[var(--pantry-line)]">
        {accounts.length === 0 && <li className="p-4 text-xs text-black/50">עדיין אין משתמשים. הוסיפו משתמש כדי שהלקוח יוכל להזמין באתר.</li>}
        {accounts.map((account) => (
          <li key={account.id} className="space-y-1.5 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{account.name}</p>
              <Badge tone={!account.isActive ? 'muted' : account.setupComplete ? 'success' : 'warning'}>
                {!account.isActive ? 'מושבת' : account.setupComplete ? 'פעיל' : 'טרם הגדיר סיסמה'}
              </Badge>
            </div>
            <p className="break-all text-xs text-black/60" dir="ltr">{account.email}</p>
            <div className="flex flex-wrap gap-1">
              {account.isActive && !account.setupComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  pending={action.isPending(`resend:${account.id}`)}
                  disabled={action.pending}
                  onClick={() => action.run(() => resendCustomerUserSetupAction({ customerId, userId: account.id }), { success: 'נשלח קישור חדש במייל.' }, `resend:${account.id}`)}
                >
                  שליחת קישור מחדש
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                pending={action.isPending(`toggle:${account.id}`)}
                disabled={action.pending}
                onClick={() => {
                  if (account.isActive && !window.confirm(`להשבית את ${account.name}? המשתמש יתנתק מיד.`)) return;
                  action.run(
                    () => setCustomerUserActiveAction({ customerId, userId: account.id, isActive: !account.isActive }),
                    { success: account.isActive ? 'המשתמש הושבת ונותק מכל המכשירים.' : 'המשתמש הופעל מחדש.' },
                    `toggle:${account.id}`,
                  );
                }}
              >
                {account.isActive ? 'השבתה' : 'הפעלה'}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <form
        className="space-y-2 border-t border-[var(--pantry-line)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const values = new FormData(form);
          action.run(
            () => inviteCustomerUserAction({ customerId, name: formValue.text(values, 'name'), email: formValue.text(values, 'email') }),
            { success: 'המשתמש נוסף ונשלח אליו קישור להגדרת סיסמה.', onSuccess: () => form.reset() },
            'invite',
          );
        }}
      >
        <p className="text-xs font-semibold">הוספת משתמש</p>
        <TextField name="name" label="שם מלא" required autoComplete="off" />
        <TextField name="email" label="אימייל" type="email" required autoComplete="off" dir="ltr" />
        <Button type="submit" fullWidth pending={action.isPending('invite')} disabled={action.pending} icon={<UserPlus size={15} />}>הוספה ושליחת קישור</Button>
        <ActionFeedback feedback={action.feedback} />
      </form>
    </Panel>
  );
}
