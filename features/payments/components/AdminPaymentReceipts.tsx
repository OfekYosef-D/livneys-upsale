'use client';

import { Ban, Banknote } from 'lucide-react';
import { useState } from 'react';
import { useServerAction } from '@/components/hooks/useServerAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldShell, formValue, SelectField, TextField } from '@/components/ui/Field';
import { ActionFeedback } from '@/components/ui/Notice';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { formatDateTime } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { recordPaymentReceiptAction, voidPaymentReceiptAction } from '../actions';
import { paymentMethodLabels, paymentMethodValues } from '../schemas';
import type { PaymentStatus } from '../service';

type Receipt = {
  id: string;
  amount: number;
  method: (typeof paymentMethodValues)[number];
  reference: string | null;
  receivedAt: string;
  note: string | null;
  status: 'RECORDED' | 'VOIDED';
  recordedByName: string;
  voidedByName: string | null;
  voidReason: string | null;
};

const statusBadges: Record<PaymentStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  PAID: { label: 'שולם', tone: 'success' },
  PARTIALLY_PAID: { label: 'שולם חלקית', tone: 'warning' },
  UNPAID: { label: 'לא שולם', tone: 'danger' },
};

/** Internal collection tracking only — not a receipt or tax invoice. */
export function AdminPaymentReceipts({
  orderId,
  total,
  summary,
  receipts,
}: {
  orderId: string;
  total: number;
  summary: { status: PaymentStatus; paidTotal: number; outstanding: number };
  receipts: Receipt[];
}) {
  const action = useServerAction();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const badge = statusBadges[summary.status];

  function record(form: FormData, element: HTMLFormElement) {
    action.run(
      () => recordPaymentReceiptAction({
        orderId,
        idempotencyKey,
        amount: formValue.text(form, 'amount'),
        method: formValue.text(form, 'method'),
        reference: formValue.text(form, 'reference'),
        note: formValue.text(form, 'note'),
        receivedAt: new Date(),
      }),
      {
        success: 'התקבול נרשם.',
        onSuccess: () => {
          element.reset();
          setIdempotencyKey(crypto.randomUUID());
        },
      },
      'record',
    );
  }

  return (
    <Panel>
      <PanelHeader title="גבייה" description="מעקב פנימי בלבד – אינו קבלה או חשבונית מס." actions={<Badge tone={badge.tone}>{badge.label}</Badge>} />
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--pantry-line)] border-b border-[var(--pantry-line)] text-center text-xs">
        <Metric label="סכום ההזמנה" value={formatMoney(total)} />
        <Metric label="התקבל" value={formatMoney(summary.paidTotal)} />
        <Metric label="יתרה" value={formatMoney(summary.outstanding)} />
      </div>

      <div className="space-y-3 p-4">
        {summary.outstanding > 0 && (
          <form
            key={summary.outstanding}
            className="grid gap-2 rounded-md border border-[var(--pantry-line)] p-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              record(new FormData(event.currentTarget), event.currentTarget);
            }}
          >
            <TextField name="amount" label="סכום" inputMode="decimal" required defaultValue={summary.outstanding} />
            <SelectField name="method" label="אמצעי תשלום" options={paymentMethodValues.map((value) => ({ value, label: paymentMethodLabels[value] }))} />
            <TextField name="reference" label="אסמכתא (לא חובה)" />
            <TextField name="note" label="הערה (לא חובה)" />
            <div className="sm:col-span-2">
              <Button type="submit" pending={action.isPending('record')} disabled={action.pending} icon={<Banknote size={16} />}>רישום תקבול</Button>
            </div>
          </form>
        )}

        {receipts.length === 0 ? (
          <p className="text-center text-xs text-black/60">טרם נרשמו תקבולים.</p>
        ) : (
          <ul className="space-y-2">
            {receipts.map((receipt) => <ReceiptRow key={receipt.id} receipt={receipt} action={action} />)}
          </ul>
        )}
        <ActionFeedback feedback={action.feedback} />
      </div>
    </Panel>
  );
}

function ReceiptRow({ receipt, action }: { receipt: Receipt; action: ReturnType<typeof useServerAction> }) {
  const [reason, setReason] = useState('');
  const voided = receipt.status === 'VOIDED';

  return (
    <li className={`rounded-md border p-3 text-xs ${voided ? 'border-red-200 bg-red-50/50 text-black/60' : 'border-[var(--pantry-line)]'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{formatMoney(receipt.amount)} · {paymentMethodLabels[receipt.method]}</p>
          <p className="mt-0.5 text-black/60">{formatDateTime(receipt.receivedAt)} · {receipt.recordedByName}{receipt.reference ? ` · אסמכתא ${receipt.reference}` : ''}</p>
          {receipt.note && <p className="mt-1 text-black/60">{receipt.note}</p>}
        </div>
        <Badge tone={voided ? 'danger' : 'success'}>{voided ? 'בוטל' : 'פעיל'}</Badge>
      </div>
      {voided ? (
        <p className="mt-2 text-red-800">סיבת ביטול: {receipt.voidReason}{receipt.voidedByName ? ` · ${receipt.voidedByName}` : ''}</p>
      ) : (
        <div className="mt-2 flex items-end gap-2">
          <FieldShell label="סיבת ביטול" className="flex-1">
            <input value={reason} onChange={(event) => setReason(event.target.value)} className="ui-field min-h-9" />
          </FieldShell>
          <Button
            variant="danger"
            size="sm"
            disabled={action.pending || reason.trim().length < 3}
            pending={action.isPending(receipt.id)}
            icon={<Ban size={13} />}
            onClick={() => action.run(() => voidPaymentReceiptAction({ receiptId: receipt.id, reason }), { success: 'התקבול בוטל.' }, receipt.id)}
          >
            ביטול
          </Button>
        </div>
      )}
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-2.5">
      <p className="text-black/60">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
