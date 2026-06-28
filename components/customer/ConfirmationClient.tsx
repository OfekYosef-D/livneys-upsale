'use client';

import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import type { PortalCustomer, PortalOrder, PortalProduct, PortalRoute } from '@/features/customer-portal/types';
import { money } from '@/lib/format';
import { brandLogo } from '@/lib/product-assets';
import { buildCartFromOrder, getCartItems, getCartPricingSummary, type Cart } from '@/lib/order-utils';

export function ConfirmationClient({
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
  const cart = useMemo<Cart>(() => buildCartFromOrder(lastOrder.items), [lastOrder.items]);

  const cartItems = useMemo(() => getCartItems(cart), [cart]);
  const fallbackPricing = useMemo(() => getCartPricingSummary(cart, products), [cart, products]);
  const orderItems: PortalOrder['items'] = lastOrder.items.length > 0 ? lastOrder.items : cartItems;
  const orderSubtotal = lastOrder.items.length > 0 ? lastOrder.subtotal : fallbackPricing.subtotal;
  const orderDiscountTotal = lastOrder.items.length > 0 ? lastOrder.discountTotal : fallbackPricing.discountTotal;
  const orderTotal = lastOrder.items.length > 0 ? lastOrder.total : fallbackPricing.total;

  return (
    <main className="app-surface min-h-screen px-3 py-4 text-black md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-3xl place-items-center">
        <section className="w-full overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_22px_70px_rgba(0,0,0,0.085)]">
          <div className="bg-[#e6e1d8] p-5 text-center">
            <Image src={brandLogo} alt="Livney's" className="mx-auto w-28" priority />
            <div className="mx-auto mt-4 grid h-14 w-14 place-items-center rounded-full bg-black text-white">
              <CheckCircle2 size={28} />
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight md:text-3xl">ההזמנה התקבלה לאישור</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm font-bold leading-6 text-black/60">
              תודה {customer.contact}. הצוות של Livney&apos;s יבדוק את ההזמנה ויצור קשר אם צריך התאמות לפני החלוקה.
            </p>
          </div>

          <div className="p-4 md:p-5">
            <div className="rounded-2xl border border-black/10 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">סיכום הזמנה</h2>
                <p className="text-xs font-bold text-black/55">חלוקה {new Intl.DateTimeFormat('he-IL').format(new Date(route.nextDelivery))}</p>
              </div>
              <div className="mt-2 divide-y divide-black/10">
                {orderItems.map((item) => {
                  const product = products.find((candidate) => candidate.id === item.productId);
                  const unitPrice = item.unitPrice ?? product?.price ?? 0;
                  const listUnitPrice = item.listUnitPrice ?? product?.listPrice ?? unitPrice;
                  const lineTotal = item.lineTotal ?? unitPrice * item.qty;

                  return (
                    <div key={item.productId} className="flex justify-between gap-3 py-1.5 text-xs">
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{item.productName ?? product?.name ?? item.productId}</span>
                        <span className="mt-0.5 block text-[11px] font-bold text-black/45">
                          {item.qty} × {money(unitPrice)}
                          {listUnitPrice > unitPrice ? ` · ${money(listUnitPrice)}` : ''}
                          {item.promotionLabel ? ` · ${item.promotionLabel}` : ''}
                        </span>
                      </span>
                      <b className="shrink-0 tabular-nums">{money(lineTotal)}</b>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 space-y-1 border-t border-black/10 pt-3 text-sm font-bold">
                <div className="flex items-center justify-between">
                  <span>סכום ביניים</span>
                  <span className="tabular-nums">{money(orderSubtotal)}</span>
                </div>
                {orderDiscountTotal > 0 && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>הנחות</span>
                    <span className="tabular-nums">-{money(orderDiscountTotal)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 text-base font-black">
                  <span>סה״כ</span>
                  <span className="tabular-nums">{money(orderTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-black/10 p-4 sm:flex-row md:p-5">
            <Button href={`/customer/${customer.id}`} className="flex-1">
              חזרה לקטלוג
            </Button>
            <Link href="/login" className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-[#e6e1d8] px-4 text-sm font-black text-black focus-visible:ring-2 focus-visible:ring-black/30">
              כניסה לחברה אחרת
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
