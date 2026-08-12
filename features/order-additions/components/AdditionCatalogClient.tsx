'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QuantityStepper } from '../../../components/ui/QuantityStepper';
import type { PortalCustomer, PortalOrder, PortalProduct } from '../../customer-portal/types';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { formatOrderNumber } from '../../orders/order-number';
import { calculatePaymentTermsSummary, paymentTermLabels } from '../../orders/payment-terms';
import { calculateVatSummary } from '../../orders/vat';
import { fallbackProductImage, productImages } from '../../../lib/product-assets';
import { money } from '../../../lib/format';
import { getCartItems, getIncrementalCartPricingSummary, setCartQuantity, type Cart } from '../../../lib/order-utils';
import { createApprovedOrderAdditionAction, submitOrderAdditionAction } from '../actions';

export function AdditionCatalogClient({
  customer,
  products,
  order,
  initialLines,
  mode = 'customer',
}: {
  customer: PortalCustomer;
  products: PortalProduct[];
  order: PortalOrder;
  initialLines: Array<{ productId: string; quantity: number }>;
  mode?: 'customer' | 'admin';
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart>(() => Object.fromEntries(initialLines.filter((line) => line.productId).map((line) => [line.productId, line.quantity])));
  const [query, setQuery] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('he');
    return normalized ? products.filter((product) => [product.name, product.category, product.sku].some((value) => value.toLocaleLowerCase('he').includes(normalized))) : products;
  }, [products, query]);
  const cartItems = getCartItems(cart, new Set(products.map((product) => product.id)));
  const pricing = getIncrementalCartPricingSummary(cart, products, order.items);
  const payment = calculatePaymentTermsSummary(pricing.total, order.paymentTerm);
  const vat = calculateVatSummary(payment.total, order.vatRatePercent);

  async function submit() {
    setError('');
    setPending(true);
    const input = {
      customerId: customer.id,
      orderId: order.id,
      idempotencyKey,
      items: cartItems.map((item) => ({ productId: item.productId, quantity: item.qty })),
    };
    const result = mode === 'admin'
      ? await createApprovedOrderAdditionAction(input)
      : await submitOrderAdditionAction(input);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      if (result.code === 'STALE_VERSION') setIdempotencyKey(crypto.randomUUID());
      return;
    }
    router.push(mode === 'admin' ? `/admin/orders/${order.id}` : `/customer/${customer.id}/orders/${order.orderNumber}`);
    router.refresh();
  }

  return (
    <main className="app-surface min-h-screen pb-28 text-black">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 px-3 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-black/45">{mode === 'admin' ? 'תוספת מנהל' : 'בקשת תוספת'} · {formatOrderNumber(order.orderNumber!)}</p>
            <h1 className="text-xl font-black md:text-2xl">הוספת פריטים בלבד</h1>
          </div>
          <Link href={mode === 'admin' ? `/admin/orders/${order.id}` : `/customer/${customer.id}/orders/${order.orderNumber}`} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#e6e1d8] px-3 text-xs font-black">
            <ArrowRight size={16} /> חזרה להזמנה
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-3 py-4 md:px-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
          <div className="flex items-start gap-2"><ShieldCheck size={19} className="mt-0.5 shrink-0" /><p>{mode === 'admin' ? 'התוספת תירשם כאושרה ותצורף מיד להזמנה הקיימת. לא ניתן להפחית מההזמנה המקורית במסך זה.' : 'זו בקשה להגדלת ההזמנה בלבד. לא ניתן להפחית מההזמנה המקורית, וכל תוספת מחייבת אישור של צוות ליבני׳ס.'}</p></div>
          <p className="mt-2 text-xs">תנאי התשלום נשארים {paymentTermLabels[order.paymentTerm]}; המחירים, ההנחות והמע״מ נשמרים בעת השליחה.</p>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section>
            <div className="sticky top-[73px] z-20 mb-3 flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white/95 px-4 shadow-sm backdrop-blur focus-within:ring-2 focus-within:ring-black/25">
              <Search size={17} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" placeholder="חיפוש מוצר להוספה…" aria-label="חיפוש מוצר להוספה" />
            </div>
            <div className="space-y-2">
              {visibleProducts.map((product) => {
                const image = product.imageUrl?.startsWith('http') ? product.imageUrl : productImages[product.assetImage ?? ''] ?? fallbackProductImage;
                return (
                  <article key={product.id} className="grid grid-cols-[4.5rem_1fr] gap-3 rounded-2xl border border-black/10 bg-white p-2.5 shadow-sm md:grid-cols-[4.5rem_1fr_10rem] md:items-center">
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-[#e6e1d8]"><Image src={image} alt={product.name} fill sizes="72px" className="object-cover" /></div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black text-black/45">{product.category}</p>
                      <h2 className="truncate font-black">{product.name}</h2>
                      <p className="mt-1 text-xs font-bold text-black/50">{money(product.price)} · מינימום {product.minQty}</p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <QuantityStepper value={cart[product.id] ?? 0} min={product.minQty} step={product.orderMultiple} onChange={(quantity) => setCart((current) => setCartQuantity(current, product.id, quantity))} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.06)] lg:sticky lg:top-[73px]">
            <p className="text-xs font-black text-black/45">סיכום בקשת התוספת</p>
            <h2 className="mt-1 text-xl font-black">{cartItems.reduce((sum, item) => sum + item.qty, 0)} יחידות</h2>
            <OrderFinancialSummary subtotal={pricing.subtotal} productDiscountTotal={pricing.discountTotal} paymentDiscountPercent={payment.paymentDiscountPercent} paymentDiscountTotal={payment.paymentDiscountTotal} totalBeforeVat={payment.total} vatRatePercent={vat.vatRatePercent} vatTotal={vat.vatTotal} totalIncludingVat={vat.totalIncludingVat} />
            <button type="button" onClick={submit} disabled={pending || cartItems.length === 0} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-black/30">
              {pending ? 'שומר תוספת…' : mode === 'admin' ? 'אישור והוספה להזמנה' : initialLines.length > 0 ? 'עדכון בקשת התוספת' : 'שליחת בקשת התוספת'}
              <ArrowLeft size={16} />
            </button>
            {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-black text-red-800">{error}</p>}
          </aside>
        </div>
      </div>
    </main>
  );
}
