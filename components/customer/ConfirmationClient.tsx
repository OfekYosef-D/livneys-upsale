'use client';

import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { brandLogo } from '@/lib/product-assets';
import { money, productById, type Customer, type Order, type Product, type Route } from '@/lib/mock-data';
import { buildCartFromOrder, getCartItems, getCartTotal, type Cart } from '@/lib/order-utils';
import { readStoredCart } from '@/lib/cart-storage';

export function ConfirmationClient({
  customer,
  route,
  products,
  lastOrder,
}: {
  customer: Customer;
  route: Route;
  products: Product[];
  lastOrder: Order;
}) {
  const [cart, setCart] = useState<Cart>(() => buildCartFromOrder(lastOrder.items));

  useEffect(() => {
    const stored = readStoredCart(customer.id);
    if (stored) {
      setCart(stored);
    }
  }, [customer.id]);

  const cartItems = useMemo(() => getCartItems(cart), [cart]);
  const cartTotal = useMemo(() => getCartTotal(cart, products), [cart, products]);

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
                {cartItems.map((item) => (
                  <div key={item.productId} className="flex justify-between gap-3 py-1.5 text-xs">
                    <span className="font-bold">{productById(item.productId).name}</span>
                    <b>{item.qty}</b>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 text-base font-black">
                <span>סה״כ משוער</span>
                <span>{money(cartTotal)}</span>
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
