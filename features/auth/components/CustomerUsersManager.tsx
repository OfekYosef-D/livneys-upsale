'use client';

import { Link2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useServerAction } from '@/components/hooks/useServerAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formValue, TextField } from '@/components/ui/Field';
import { ActionFeedback } from '@/components/ui/Notice';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { issueCustomerAccessLinkAction, inviteCustomerUserAction, setCustomerUserActiveAction } from '../actions';
import type { AccountAccessLink } from '../notifications';
import { AccessLinkShare } from './AccessLinkShare';

type Account = { id: string; name: string; email: string; isActive: boolean; setupComplete: boolean };

/**
 * Login accounts of one company. Access goes by one-time links the team sends (WhatsApp, and email
 * when configured); the team never sees passwords.
 */
export function CustomerUsersManager({ customerId, phone, accounts }: { customerId: string; phone: string | null; accounts: Account[] }) {
  const action = useServerAction();
  const [shared, setShared] = useState<{ userId: string; link: AccountAccessLink } | null>(null);
  const share = (data: { userId: string; link: AccountAccessLink }) => setShared(data);

  return (
    <Panel>
      <PanelHeader title="משתמשים עם גישה" description="כל משתמש מקבל קישור אישי להגדרת סיסמה, שאתם שולחים לו בוואטסאפ." />
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
              {account.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Link2 size={14} />}
                  pending={action.isPending(`link:${account.id}`)}
                  disabled={action.pending}
                  onClick={() => action.run(() => issueCustomerAccessLinkAction({ customerId, userId: account.id }), { onSuccess: share }, `link:${account.id}`)}
                >
                  {account.setupComplete ? 'קישור לאיפוס סיסמה' : 'קישור כניסה'}
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
            {shared?.userId === account.id && <AccessLinkShare link={shared.link} contact={account.name} phone={phone} />}
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
            { success: 'המשתמש נוסף. שלחו לו את קישור הכניסה מהשורה שלו.', onSuccess: (data) => { share(data); form.reset(); } },
            'invite',
          );
        }}
      >
        <p className="text-xs font-semibold">הוספת משתמש</p>
        <TextField name="name" label="שם מלא" required autoComplete="off" />
        <TextField name="email" label="אימייל (שם המשתמש לכניסה)" type="email" required autoComplete="off" dir="ltr" />
        <Button type="submit" fullWidth pending={action.isPending('invite')} disabled={action.pending} icon={<UserPlus size={15} />}>הוספה ויצירת קישור כניסה</Button>
        <ActionFeedback feedback={action.feedback} />
      </form>
    </Panel>
  );
}
