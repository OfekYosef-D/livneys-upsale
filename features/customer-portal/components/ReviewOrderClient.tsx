'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState, Notice } from '@/components/ui/Notice';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { formatShortDateTime, formatWeekdayDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { paths } from '@/lib/paths';
import { useCart } from '../../cart/useCart';
import { LEGAL_DOCUMENT_SET_VERSION, legalDocuments } from '../../legal/documents';
import { getMissingForMinimum } from '../../orders/business-rules';
import { COMMERCIAL_ORDER_DECLARATION, COMMERCIAL_ORDER_NOTICE } from '../../orders/commercial-terms';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { getMinimumQuantity, getOrderMultiple } from '../../orders/quantity';
import { calculateOrderTotals, IMMEDIATE_PAYMENT_DISCOUNT_PERCENT, paymentTermLabels, paymentTermValues, type PaymentTermValue } from '../../orders/totals';
import { submitCustomerOrderAction } from '../actions';
import type { CustomerPortalData } from '../types';
import { CustomerHeader } from './CustomerHeader';
import { MinimumOrderProgress } from './MinimumOrderProgress';

export function ReviewOrderClient({ data }: { data: CustomerPortalData }) {
  const router = useRouter();
  const { customer, schedule, products } = data;
  const cart = useCart(data.cartSeed, products);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [notes, setNotes] = useState('');
  const [paymentTerm, setPaymentTerm] = useState<PaymentTermValue>('NET_30');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productsById = new Map(products.map((product) => [product.id, product]));
  const totals = calculateOrderTotals({ ...cart.pricing, paymentTerm, vatRatePercent: data.vatRatePercent });
  const belowMinimum = getMissingForMinimum(cart.pricing.total) > 0;

  async function submit() {
    setError(null);
    setSubmitting(true);
    const result = await submitCustomerOrderAction({
      customerId: customer.id,
      idempotencyKey,
      items: cart.items,
      notes,
      paymentTerm,
      commercialTermsAccepted: accepted,
      vatRatePercent: data.vatRatePercent,
      legalDocumentSetVersion: LEGAL_DOCUMENT_SET_VERSION,
    });
    if (result.ok) {
      router.push(paths.customer.confirmation(customer.id, result.data.orderId));
      return;
    }
    if (result.code === 'ACTIVE_ORDER_EXISTS' && typeof result.details?.orderNumber === 'number') {
      router.push(paths.customer.order(customer.id, result.details.orderNumber));
      return;
    }
    setSubmitting(false);
    setError(result.error);
  }

  return (
    <main className="app-surface min-h-screen pb-16 text-black">
      <CustomerHeader
        title="סיכום ההזמנה"
        subtitle={`${customer.name} · חלוקה ב${formatWeekdayDate(schedule.deliveryAt)}`}
        actions={<Button href={paths.customer.home(customer.id)} variant="outline" size="sm" icon={<ArrowRight size={14} />}>לקטלוג</Button>}
      />

      <div className="mx-auto mt-4 grid max-w-5xl gap-4 px-3 md:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-3">
          {cart.adjustmentNotice && <Notice tone="warning">{cart.adjustmentNotice}</Notice>}
          {schedule.isPastCutoff && (
            <Notice tone="warning" title="מועד ההזמנה עבר">ההזמנה תישלח כבקשה מיוחדת לאישור הצוות.</Notice>
          )}
          <div className="ui-panel">
            {cart.items.length === 0 ? (
              <EmptyState
                title="הסל ריק"
                description="חזרו לקטלוג והוסיפו מוצרים."
                action={<Button href={paths.customer.home(customer.id)} variant="secondary">לקטלוג</Button>}
              />
            ) : (
              <ul className="divide-y divide-[var(--pantry-line)]">
                {cart.pricing.lines.map((line) => {
                  const product = productsById.get(line.productId)!;
                  return (
                    <li key={line.productId} className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_9rem_6.5rem] sm:items-center sm:gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{line.productName}</p>
                        <p className="text-xs text-black/55">{product.unit} · {formatMoney(line.unitPrice)} ליחידה</p>
                      </div>
                      <QuantityStepper
                        value={line.quantity}
                        min={getMinimumQuantity(product)}
                        step={getOrderMultiple(product)}
                        onChange={(quantity) => cart.setQuantity(line.productId, quantity)}
                      />
                      <p className="text-sm font-semibold tabular-nums sm:text-left">
                        {formatMoney(line.lineTotal)}
                        {line.discountTotal > 0 && <span className="block text-[11px] font-medium text-emerald-700">חיסכון {formatMoney(line.discountTotal)}</span>}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="ui-panel h-fit space-y-4 p-4 lg:sticky lg:top-20">
          <fieldset>
            <legend className="text-sm font-semibold">תנאי תשלום</legend>
            <div className="mt-2 grid gap-2">
              {paymentTermValues.map((option) => (
                <label
                  key={option}
                  className={`cursor-pointer rounded-md border p-3 transition focus-within:ring-2 focus-within:ring-black/25 ${paymentTerm === option ? 'border-black bg-black text-white' : 'border-[var(--pantry-line)] bg-[var(--pantry-soft)]'}`}
                >
                  <input type="radio" name="paymentTerm" value={option} checked={paymentTerm === option} onChange={() => setPaymentTerm(option)} className="sr-only" />
                  <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                    {paymentTermLabels[option]}
                    {option === 'IMMEDIATE_OR_CASH' && <span className="text-xs">{IMMEDIATE_PAYMENT_DISCOUNT_PERCENT}% הנחה</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="ui-label">הערות להזמנה (לא חובה)</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="לדוגמה: נא להגיע בשעות הבוקר" className="ui-field min-h-20 resize-y py-2" />
          </label>

          <OrderFinancialSummary totals={totals} />
          {cart.items.length > 0 && <MinimumOrderProgress totalBeforeVat={cart.pricing.total} />}

          <div className="space-y-2 border-t border-[var(--pantry-line)] pt-3">
            <p className="flex items-start gap-2 text-[11px] leading-5 text-black/55">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-black" aria-hidden="true" />
              {COMMERCIAL_ORDER_NOTICE}
            </p>
            <label className="flex cursor-pointer items-start gap-2 rounded-md bg-[var(--pantry-soft)] p-2.5 text-xs leading-5">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" />
              <span>
                {COMMERCIAL_ORDER_DECLARATION}{' '}
                {legalDocuments.map((document, index) => (
                  <span key={document.slug}>
                    {index > 0 && ' · '}
                    <Link href={paths.legal(document.slug)} target="_blank" className="underline">{document.title}</Link>
                  </span>
                ))}
              </span>
            </label>
          </div>

          {error && <Notice tone="danger">{error}</Notice>}
          <Button
            fullWidth
            size="lg"
            onClick={submit}
            disabled={cart.items.length === 0 || !accepted || belowMinimum}
            pending={submitting}
            pendingLabel="שולחים…"
          >
            שליחת ההזמנה <ArrowLeft size={16} aria-hidden="true" />
          </Button>
          <p className="text-center text-[11px] text-black/50">ניתן לשלוח עד {formatShortDateTime(schedule.cutoffAt)}</p>
        </aside>
      </div>
    </main>
  );
}
