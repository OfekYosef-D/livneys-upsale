'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { submitCustomerOrderAction } from '@/features/customer-portal/actions';
import type { PortalCustomer, PortalOrder, PortalProduct, PortalRoute } from '@/features/customer-portal/types';
import { money } from '@/lib/format';
import { buildCartFromOrder, getCartItems, getCartPricingSummary, setCartQuantity, type Cart } from '@/lib/order-utils';

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
  const [cart, setCart] = useState<Cart>(() => buildCartFromOrder(lastOrder.items));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cartItems = useMemo(() => getCartItems(cart), [cart]);
  const cartPricing = useMemo(() => getCartPricingSummary(cart, products), [cart, products]);

  async function submitOrder() {
    setError('');
    setIsSubmitting(true);
    const result = await submitCustomerOrderAction({ customerId: customer.id, items: cartItems, notes });
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
                    const product = products.find((candidate) => candidate.id === item.productId) ?? products[0];
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
                            step={1}
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
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-black">הערות להזמנה</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="לדוגמה: נא לתאם הגעה בבוקר"
                  className="min-h-20 w-full rounded-xl border border-black/12 bg-white p-2.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-black/25"
                />
              </label>
              <div className="mt-3 space-y-1 border-t border-black/10 pt-3 text-sm font-bold">
                <div className="flex items-center justify-between">
                  <span>סכום ביניים</span>
                  <span className="tabular-nums">{money(cartPricing.subtotal)}</span>
                </div>
                {cartPricing.discountTotal > 0 && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>הנחות</span>
                    <span className="tabular-nums">-{money(cartPricing.discountTotal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 text-base font-black">
                  <span>סה״כ משוער</span>
                  <span className="tabular-nums">{money(cartPricing.total)}</span>
                </div>
              </div>
              <button
                onClick={submitOrder}
                disabled={cartItems.length === 0 || isSubmitting}
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
