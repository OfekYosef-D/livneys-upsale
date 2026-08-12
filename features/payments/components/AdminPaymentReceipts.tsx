'use client';

import { Banknote, Ban, CircleDollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { money } from '../../../lib/format';
import { recordPaymentReceiptAction, voidPaymentReceiptAction } from '../actions';
import { paymentMethodValues } from '../schemas';

type PaymentMethod = (typeof paymentMethodValues)[number];
type Receipt = {
  id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: string;
  note: string | null;
  status: 'RECORDED' | 'VOIDED';
  recordedByName: string;
  voidedAt: string | null;
  voidedByName: string | null;
  voidReason: string | null;
};

const methodLabels: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'העברה בנקאית', CASH: 'מזומן', CHECK: 'המחאה', CREDIT_CARD: 'כרטיס אשראי', OTHER: 'אחר',
};

export function AdminPaymentReceipts({ orderId, total, paidTotal, outstanding, status, receipts }: {
  orderId: string;
  total: number;
  paidTotal: number;
  outstanding: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  receipts: Receipt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : '');
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  function submitReceipt() {
    setMessage('');
    startTransition(async () => {
      const result = await recordPaymentReceiptAction({
        orderId,
        amount,
        method,
        reference: reference || null,
        note: note || null,
        receivedAt: new Date(),
      });
      if (!result.ok) return setMessage(result.error);
      setMessage('התקבול נרשם בהצלחה.');
      setReference('');
      setNote('');
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-2"><CircleDollarSign size={20} /><div><p className="text-xs font-black text-black/45">מעקב גבייה ידני</p><h2 className="text-xl font-black">תקבולים</h2></div></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <Metric label="סכום הזמנה" value={money(total)} />
        <Metric label="התקבל" value={money(paidTotal)} />
        <Metric label="יתרה" value={money(outstanding)} />
      </div>
      <p className={`mt-3 rounded-xl px-3 py-2 text-center text-sm font-black ${status === 'PAID' ? 'bg-emerald-50 text-emerald-800' : status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800'}`}>
        {status === 'PAID' ? 'שולם' : status === 'PARTIALLY_PAID' ? 'שולם חלקית' : 'לא שולם'}
      </p>

      {outstanding > 0 && (
        <div className="mt-4 grid gap-2 rounded-xl border border-black/10 p-3">
          <label className="text-xs font-black">סכום<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-black/15 px-3 text-base" /></label>
          <label className="text-xs font-black">אמצעי תשלום<select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="mt-1 min-h-10 w-full rounded-xl border border-black/15 px-3 text-sm">{paymentMethodValues.map((value) => <option key={value} value={value}>{methodLabels[value]}</option>)}</select></label>
          <label className="text-xs font-black">אסמכתא (רשות)<input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-black/15 px-3 text-sm" /></label>
          <label className="text-xs font-black">הערה פנימית (רשות)<textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-16 w-full rounded-xl border border-black/15 p-3 text-sm" /></label>
          <button type="button" disabled={pending || !amount} onClick={submitReceipt} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white disabled:opacity-40"><Banknote size={16} />רישום תקבול</button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {receipts.map((receipt) => <ReceiptRow key={receipt.id} orderId={orderId} receipt={receipt} pending={pending} startTransition={startTransition} onMessage={setMessage} onRefresh={() => router.refresh()} />)}
        {receipts.length === 0 && <p className="rounded-xl bg-[#f7f5f1] p-3 text-center text-xs font-bold text-black/55">טרם נרשמו תקבולים.</p>}
      </div>
      {message && <p aria-live="polite" className="mt-3 text-xs font-black text-black/65">{message}</p>}
      <p className="mt-3 text-[11px] font-bold leading-5 text-black/50">הרישום מיועד למעקב פנימי בלבד. הוא אינו קבלה, חשבונית מס או אישור סליקה; מסמכי המס מופקים במערכת הנהלת החשבונות של העסק.</p>
    </section>
  );
}

function ReceiptRow({ orderId, receipt, pending, startTransition, onMessage, onRefresh }: {
  orderId: string; receipt: Receipt; pending: boolean; startTransition: React.TransitionStartFunction; onMessage: (message: string) => void; onRefresh: () => void;
}) {
  const [reason, setReason] = useState('');
  function voidReceipt() {
    startTransition(async () => {
      const result = await voidPaymentReceiptAction({ orderId, receiptId: receipt.id, reason });
      if (!result.ok) return onMessage(result.error);
      onMessage('התקבול בוטל ונשמר ביומן הביקורת.');
      onRefresh();
    });
  }
  return (
    <article className={`rounded-xl border p-3 text-xs ${receipt.status === 'VOIDED' ? 'border-red-200 bg-red-50/50 text-black/55' : 'border-black/10'}`}>
      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black">{money(receipt.amount)} · {methodLabels[receipt.method]}</p><p className="mt-1 font-bold text-black/50">{formatDate(receipt.receivedAt)} · {receipt.recordedByName}</p></div><span className="rounded-full bg-black/5 px-2 py-1 font-black">{receipt.status === 'RECORDED' ? 'פעיל' : 'בוטל'}</span></div>
      {receipt.reference && <p className="mt-2 font-bold">אסמכתא: {receipt.reference}</p>}
      {receipt.note && <p className="mt-1 text-black/60">{receipt.note}</p>}
      {receipt.status === 'VOIDED' ? <p className="mt-2 font-bold text-red-800">בוטל: {receipt.voidReason} {receipt.voidedByName ? `· ${receipt.voidedByName}` : ''}</p> : (
        <div className="mt-2 flex gap-2"><input aria-label="סיבת ביטול התקבול" placeholder="סיבת ביטול" value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-9 min-w-0 flex-1 rounded-xl border border-black/15 px-3" /><button type="button" disabled={pending || reason.trim().length < 3} onClick={voidReceipt} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-red-50 px-3 font-black text-red-800 disabled:opacity-40"><Ban size={14} />ביטול</button></div>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f7f5f1] p-2"><p className="text-black/45">{label}</p><p className="mt-1 tabular-nums">{value}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(value)); }
