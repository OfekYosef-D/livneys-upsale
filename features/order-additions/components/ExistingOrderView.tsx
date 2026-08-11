import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock3, PackageCheck, Plus, ShieldCheck } from 'lucide-react';
import type { PortalCustomer } from '../../customer-portal/types';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { formatOrderNumber } from '../../orders/order-number';
import { paymentTermLabels } from '../../orders/payment-terms';
import { orderStatusLabels } from '../../orders/utils';
import { COMMERCIAL_ORDER_NOTICE } from '../../orders/commercial-terms';
import { money } from '../../../lib/format';
import type { getCustomerOrderAdditionData } from '../queries';
import { getAdditionRequestPresentation } from '../ui';

type Data = NonNullable<Awaited<ReturnType<typeof getCustomerOrderAdditionData>>>;

export function ExistingOrderView({ customer, data }: { customer: PortalCustomer; data: Data }) {
  const addition = data.additionRequest;
  const presentation = addition ? getAdditionRequestPresentation(addition.status) : null;
  const additionHref = `/customer/${customer.id}/orders/${data.order.orderNumber}/addition`;

  return (
    <main className="app-surface min-h-screen px-3 py-4 text-black md:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="overflow-hidden rounded-3xl border border-black/10 bg-black text-white shadow-[0_24px_70px_rgba(0,0,0,0.13)]">
          <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end md:p-7">
            <div>
              <div className="flex items-center gap-2 text-xs font-black text-white/55">
                <CheckCircle2 size={16} aria-hidden="true" />
                ההזמנה השבועית שלך כבר במערכת
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">{formatOrderNumber(data.order.orderNumber!)}</h1>
              <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-white/65">
                {customer.name} · חלוקה {new Intl.DateTimeFormat('he-IL', { dateStyle: 'long' }).format(new Date(data.deliveryWindowStart))}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black ring-1 ring-white/15">
              <Clock3 size={16} aria-hidden="true" />
              {orderStatusLabels[data.order.status as keyof typeof orderStatusLabels] ?? data.order.status}
            </div>
          </div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-[#e6e1d8] px-4 py-3">
              <div>
                <p className="text-xs font-black text-black/45">פריטי ההזמנה</p>
                <h2 className="text-xl font-black">מה שכבר הוזמן</h2>
              </div>
              <PackageCheck size={24} aria-hidden="true" />
            </div>
            <div className="divide-y divide-black/10">
              {data.order.items.map((line, index) => (
                <article key={`${line.productId}-${line.productName}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-black">{line.productName}</p>
                    <p className="mt-1 text-xs font-bold text-black/45">{line.qty} × {money(line.unitPrice ?? 0)}</p>
                  </div>
                  <p className="font-black tabular-nums">{money(line.lineTotal ?? 0)}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
              <p className="text-xs font-black text-black/45">תנאי תשלום</p>
              <p className="mt-1 text-base font-black">{paymentTermLabels[data.order.paymentTerm]}</p>
              <OrderFinancialSummary
                subtotal={data.order.subtotal}
                productDiscountTotal={data.order.discountTotal}
                paymentDiscountPercent={data.order.paymentDiscountPercent}
                paymentDiscountTotal={data.order.paymentDiscountTotal}
                totalBeforeVat={data.order.total}
                vatRatePercent={data.order.vatRatePercent}
                vatTotal={data.order.vatTotal}
                totalIncludingVat={data.order.totalIncludingVat}
              />
            </section>

            <section className="rounded-2xl border border-black/10 bg-[#e6e1d8] p-4">
              <div className="flex items-start gap-2">
                <Plus size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="font-black">צריך להוסיף משהו?</h2>
                  <p className="mt-1 text-xs font-bold leading-5 text-black/55">הפריטים יישלחו כבקשת תוספת נפרדת ויצורפו להזמנה רק לאחר אישור הצוות.</p>
                </div>
              </div>
              {addition && presentation && (
                <div className={`mt-3 rounded-xl p-3 text-xs font-bold ${presentation.tone}`}>
                  <p className="font-black">בקשת התוספת: {presentation.label}</p>
                  {addition.rejectionReason && <p className="mt-1">סיבה: {addition.rejectionReason}</p>}
                  {addition.lines.length > 0 && <p className="mt-1">{addition.lines.length} מוצרים · {money(addition.totalIncludingVat)} כולל מע״מ</p>}
                </div>
              )}
              {data.canAddItems && (
                <Link href={additionHref} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white focus-visible:ring-2 focus-visible:ring-black/30">
                  {presentation?.actionLabel ?? 'הוספת פריטים להזמנה'}
                  <ArrowLeft size={16} aria-hidden="true" />
                </Link>
              )}
              {!data.canAddItems && <p className="mt-3 text-xs font-black text-black/55">לא ניתן להוסיף פריטים לאחר שההזמנה עברה לאריזה.</p>}
            </section>

            <section className="flex items-start gap-2 rounded-2xl border border-black/10 bg-white p-4 text-xs font-bold leading-5 text-black/55">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-black" aria-hidden="true" />
              <p>{COMMERCIAL_ORDER_NOTICE}</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
