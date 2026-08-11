'use client';

import { useRouter } from 'next/navigation';
import { Check, Clock3, PlusCircle, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { money } from '../../../lib/format';
import { reviewOrderAdditionAction } from '../actions';
import { getAdditionRequestPresentation } from '../ui';

type RequestData = {
  id: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  subtotal: number;
  discountTotal: number;
  paymentDiscountPercent: number;
  paymentDiscountTotal: number;
  total: number;
  vatRatePercent: number;
  vatTotal: number;
  totalIncludingVat: number;
  lines: Array<{ id: string; productName: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

export function AdminAdditionRequests({ orderId, requests }: { orderId: string; requests: RequestData[] }) {
  if (requests.length === 0) return null;
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-2"><PlusCircle size={20} /><div><p className="text-xs font-black text-black/45">שינויים לאחר השליחה</p><h2 className="text-xl font-black">בקשות תוספת</h2></div></div>
      <div className="mt-3 grid gap-3">
        {requests.map((request) => <AdminAdditionRequest key={request.id} orderId={orderId} request={request} />)}
      </div>
    </section>
  );
}

function AdminAdditionRequest({ orderId, request }: { orderId: string; request: RequestData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const presentation = getAdditionRequestPresentation(request.status);

  function decide(decision: 'APPROVED' | 'REJECTED') {
    setMessage('');
    startTransition(async () => {
      const result = await reviewOrderAdditionAction({ requestId: request.id, decision, reason });
      if (!result.ok) { setMessage(result.error); return; }
      setMessage(decision === 'APPROVED' ? 'הפריטים נוספו להזמנה.' : 'הבקשה נדחתה והלקוח יקבל את הסיבה.');
      router.refresh();
    });
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-black/10">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-[#f7f5f1] px-4 py-3">
        <div className="flex items-center gap-2"><Clock3 size={16} /><p className="text-sm font-black">נשלחה {new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(request.submittedAt))}</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${presentation.tone}`}>{presentation.label}</span>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="divide-y divide-black/10">
          {request.lines.map((line) => (
            <div key={line.id} className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm"><div><p className="font-black">{line.productName}</p><p className="text-xs font-bold text-black/45">{line.quantity} × {money(line.unitPrice)}</p></div><p className="font-black">{money(line.lineTotal)}</p></div>
          ))}
          {request.rejectionReason && <p className="pt-3 text-sm font-bold text-red-800">סיבת דחייה: {request.rejectionReason}</p>}
        </div>
        <div>
          <OrderFinancialSummary subtotal={request.subtotal} productDiscountTotal={request.discountTotal} paymentDiscountPercent={request.paymentDiscountPercent} paymentDiscountTotal={request.paymentDiscountTotal} totalBeforeVat={request.total} vatRatePercent={request.vatRatePercent} vatTotal={request.vatTotal} totalIncludingVat={request.totalIncludingVat} />
          {request.status === 'PENDING' && (
            <div className="mt-3 space-y-2">
              <button type="button" disabled={pending} onClick={() => decide('APPROVED')} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white disabled:opacity-40"><Check size={16} />אישור והוספה להזמנה</button>
              <label className="block"><span className="text-xs font-black text-black/50">סיבה לדחייה</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-16 w-full rounded-xl border border-black/10 p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-black/20" /></label>
              <button type="button" disabled={pending || !reason.trim()} onClick={() => decide('REJECTED')} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-red-50 px-4 text-sm font-black text-red-800 disabled:opacity-40"><X size={16} />דחיית הבקשה</button>
            </div>
          )}
          {request.reviewedAt && <p className="mt-3 text-[11px] font-bold text-black/45">טופלה {new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(request.reviewedAt))}{request.reviewedByName ? ` על ידי ${request.reviewedByName}` : ''}</p>}
          {message && <p className="mt-2 text-xs font-black text-black/60">{message}</p>}
          <span className="sr-only">{orderId}</span>
        </div>
      </div>
    </article>
  );
}
