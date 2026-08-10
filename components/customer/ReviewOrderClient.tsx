'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CartAdjustmentNotice } from '@/components/customer/CartAdjustmentNotice';
import { OrderFinancialSummary } from '@/features/orders/components/OrderFinancialSummary';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { submitCustomerOrderAction } from '@/features/customer-portal/actions';
import type { PortalCustomer, PortalOrder, PortalProduct, PortalRoute } from '@/features/customer-portal/types';
import { COMMERCIAL_ORDER_DECLARATION, COMMERCIAL_ORDER_NOTICE } from '@/features/orders/commercial-terms';
import {
  calculatePaymentTermsSummary,
  paymentTermLabels,
  type PaymentTermValue,
} from '@/features/orders/payment-terms';
import { calculateVatSummary } from '@/features/orders/vat';
import { money } from '@/lib/format';
import {
  getAllowedProductIds,
  getCartItems,
  getCartPricingSummary,
  prepareCustomerCart,
  REMOVED_UNAVAILABLE_CART_ITEMS_MESSAGE,
  setCartQuantity,
  type Cart,
} from '@/lib/order-utils';

export function ReviewOrderClient({
  customer,
  route,
  products,
  lastOrder,
}: {
  customer: PortalCustomer;
  route: PortalRoute;
  products: PortalProduct[];
  lastOrder: PortalOrder;
}) {
  const router = useRouter();
  const allowedProductIds = useMemo(() => getAllowedProductIds(products), [products]);
  const preparedCart = useMemo(() => prepareCustomerCart(lastOrder.items, products), [lastOrder.items, products]);
  const [cart, setCart] = useState<Cart>(() => preparedCart.cart);
  const [cartNotice, setCartNotice] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentTerm, setPaymentTerm] = useState<PaymentTermValue>('NET_30');
  const [commercialTermsAccepted, setCommercialTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCart(preparedCart.cart);

    if (preparedCart.removedUnavailableCount > 0) {
      setCartNotice(REMOVED_UNAVAILABLE_CART_ITEMS_MESSAGE);
      return;
    }

    if (preparedCart.adjustedBelowMinimumCount > 0) {
      setCartNotice('כמות של חלק מהמוצרים עודכנה לכמות המינימלית.');
      return;
    }

    if (preparedCart.adjustedToMultipleCount > 0) {
      setCartNotice('הכמות של חלק מהמוצרים עודכנה לכפולות הארגז.');
      return;
    }

    setCartNotice('');
  }, [preparedCart]);

  const cartItems = useMemo(() => getCartItems(cart, allowedProductIds), [allowedProductIds, cart]);
  const cartPricing = useMemo(() => getCartPricingSummary(cart, products), [cart, products]);
  const paymentSummary = useMemo(
    () => calculatePaymentTermsSummary(cartPricing.total, paymentTerm),
    [cartPricing.total, paymentTerm],
  );
  const vatSummary = useMemo(() => calculateVatSummary(paymentSummary.total), [paymentSummary.total]);

  async function submitOrder() {
    setError('');
    setIsSubmitting(true);
    const result = await submitCustomerOrderAction({
      customerId: customer.id,
      items: cartItems,
      notes,
      paymentTerm,
      commercialTermsAccepted,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/customer/${customer.id}/confirmation?orderId=${result.data.orderId}`);
  }

  return (
    <main className="app-surface min-h-screen px-3 py-4 pb-20 text-black md:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-3 border-b border-black/10 pb-3">
          <div>
            <p className="text-xs font-black text-black/45">סקירת הזמנה</p>
            <h1 className="text-2xl font-black md:text-3xl">בדיקה אחרונה לפני שליחה</h1>
          </div>
          <Link href={`/customer/${customer.id}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-black ring-1 ring-black/10 focus-visible:ring-2 focus-visible:ring-black/30">
            <ArrowRight size={16} />
            חזרה
          </Link>
        </header>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_17rem]">
          {cartNotice && <div className="lg:col-span-2"><CartAdjustmentNotice message={cartNotice} /></div>}
          <section>
            {cartItems.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
                <h2 className="text-xl font-black">הסל ריק</h2>
                <p className="mt-2 text-black/55">חזרו לקטלוג והוסיפו מוצרים להזמנה.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
                <div className="hidden grid-cols-[1fr_8.75rem_6.5rem] gap-3 border-b border-black/10 bg-[#e6e1d8] px-3 py-2 text-xs font-black text-black/55 md:grid">
                  <span>מוצר</span>
                  <span className="text-center">כמות</span>
                  <span className="text-left">סה״כ</span>
                </div>
                <div className="divide-y divide-black/10">
                  {cartItems.map((item) => {
                    const product = products.find((candidate) => candidate.id === item.productId);
                    if (!product) return null;

                    const linePricing = getCartPricingSummary({ [item.productId]: item.qty }, [product]);

                    return (
                      <article key={item.productId} className="grid gap-2 px-3 py-2.5 md:grid-cols-[1fr_8.75rem_6.5rem] md:items-center md:gap-3">
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-3 md:block">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-black text-black/45">{product.category}</p>
                              <h2 className="truncate text-sm font-black md:text-base">{product.name}</h2>
                            </div>
                            <p className="shrink-0 text-xs font-black text-black/55 md:hidden">{money(product.price)}</p>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-bold text-black/52">
                            {product.unit} · {product.caseSize} · {money(product.price)} ליחידה
                          </p>
                        </div>
                        <div className="w-36 md:w-full">
                          <QuantityStepper
                            value={item.qty}
                            min={product.minQty ?? 1}
                            step={product.orderMultiple ?? product.minQty ?? 1}
                            onChange={(qty) => setCart((current) => setCartQuantity(current, item.productId, qty))}
                          />
                        </div>
                        <div className="flex items-center justify-between text-sm font-black md:block md:text-left">
                          <span className="text-xs text-black/45 md:hidden">סה״כ שורה</span>
                          <span>{money(linePricing.total)}</span>
                          {linePricing.discountTotal > 0 && <p className="text-[11px] font-bold text-emerald-700">-{money(linePricing.discountTotal)}</p>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-[0_14px_42px_rgba(0,0,0,0.055)]">
              <h2 className="text-xl font-black">סיכום</h2>
              <div className="mt-2 space-y-1 text-xs font-bold text-black/60">
                <p>{customer.name} · {customer.contact}</p>
                <p>חלוקה {new Intl.DateTimeFormat('he-IL').format(new Date(route.nextDelivery))}</p>
              </div>
              <fieldset className="mt-3 border-t border-black/10 pt-3">
                <legend className="text-xs font-black">תנאי תשלום</legend>
                <div className="mt-2 grid gap-2">
                  {(['NET_30', 'IMMEDIATE_OR_CASH'] as const).map((option) => {
                    const selected = paymentTerm === option;
                    return (
                      <label
                        key={option}
                        className={`cursor-pointer rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-black/25 ${
                          selected ? 'border-black bg-black text-white' : 'border-black/10 bg-[#f7f5f1] text-black'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentTerm"
                          value={option}
                          checked={selected}
                          onChange={() => setPaymentTerm(option)}
                          className="sr-only"
                        />
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-black">{paymentTermLabels[option]}</span>
                          {option === 'IMMEDIATE_OR_CASH' && (
                            <span className={`rounded-full px-2 py-1 text-[11px] font-black ${selected ? 'bg-white text-black' : 'bg-emerald-100 text-emerald-800'}`}>
                              5% הנחה
                            </span>
                          )}
                        </span>
                        <span className={`mt-1 block text-[11px] font-bold ${selected ? 'text-white/70' : 'text-black/50'}`}>
                          {option === 'NET_30' ? 'ללא הנחת תשלום' : 'ההנחה מחושבת לאחר מבצעי המוצר'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-black">הערות להזמנה</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="לדוגמה: נא לתאם הגעה בשעות הבוקר"
                  className="min-h-20 w-full rounded-xl border border-black/12 bg-white p-2.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-black/25"
                />
              </label>
              <OrderFinancialSummary
                subtotal={cartPricing.subtotal}
                productDiscountTotal={cartPricing.discountTotal}
                paymentDiscountPercent={paymentSummary.paymentDiscountPercent}
                paymentDiscountTotal={paymentSummary.paymentDiscountTotal}
                totalBeforeVat={paymentSummary.total}
                vatRatePercent={vatSummary.vatRatePercent}
                vatTotal={vatSummary.vatTotal}
                totalIncludingVat={vatSummary.totalIncludingVat}
              />
              <div className="mt-3 rounded-xl border border-black/10 bg-[#f7f5f1] p-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-black">אישור הזמנה עסקית</p>
                    <p id="commercial-order-notice" className="mt-1 text-[11px] font-bold leading-5 text-black/55">{COMMERCIAL_ORDER_NOTICE}</p>
                  </div>
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-white p-2.5 text-xs font-bold leading-5 ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-black/30">
                  <input
                    type="checkbox"
                    checked={commercialTermsAccepted}
                    onChange={(event) => setCommercialTermsAccepted(event.target.checked)}
                    aria-describedby="commercial-order-notice"
                    className="mt-1 h-4 w-4 shrink-0 accent-black"
                  />
                  <span>{COMMERCIAL_ORDER_DECLARATION}</span>
                </label>
              </div>
              <button
                onClick={submitOrder}
                disabled={cartItems.length === 0 || !commercialTermsAccepted || isSubmitting}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:bg-black/30"
              >
                {isSubmitting ? 'שולח...' : 'שלח הזמנה לאישור'}
                <ArrowLeft size={16} />
              </button>
              {error && <p className="mt-3 rounded-xl bg-[#e6e1d8] p-2.5 text-xs font-black text-red-700">{error}</p>}
            </div>

            <div className="rounded-2xl bg-[#e6e1d8] p-3">
              <div className="flex items-center gap-2">
                <Truck size={18} />
                <p className="text-xs font-black">יש לשלוח עד {route.deadline}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
