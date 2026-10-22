'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { formatMoney } from '@/lib/money';
import { filterCatalog, getCartItems, priceCartIncrement, setCartQuantity, type Cart } from '../../cart/cart';
import { ProductImage } from '../../catalog/components/ProductImage';
import type { CatalogProduct } from '../../catalog/customer-catalog';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { getMinimumQuantity, getOrderMultiple } from '../../orders/quantity';
import { formatOrderNumber } from '../../orders/status';
import { calculateOrderTotals, paymentTermLabels } from '../../orders/totals';
import type { OrderView } from '../../orders/view-model';
import { createApprovedOrderAdditionAction, submitOrderAdditionAction } from '../actions';

/** Add-only catalog for an existing order. Customers send a request; admins record an approved addition. */
export function AdditionCatalogClient({
  customerId,
  products,
  order,
  initialLines,
  mode,
  returnHref,
}: {
  customerId: string;
  products: CatalogProduct[];
  order: OrderView;
  initialLines: Array<{ productId: string | null; quantity: number }>;
  mode: 'customer' | 'admin';
  returnHref: string;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart>(() =>
    initialLines.reduce<Cart>((acc, line) => (line.productId ? setCartQuantity(acc, line.productId, line.quantity) : acc), {}));
  const [query, setQuery] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleProducts = useMemo(() => filterCatalog(products, { category: 'all', query }), [products, query]);
  const items = getCartItems(cart);
  const existingItems = order.lines.flatMap((line) => (line.productId ? [{ productId: line.productId, quantity: line.quantity }] : []));
  const increment = priceCartIncrement(cart, products, existingItems);
  const totals = calculateOrderTotals({ ...increment, paymentTerm: order.paymentTerm, vatRatePercent: order.vatRatePercent });

  async function submit() {
    setError(null);
    setPending(true);
    const input = { customerId, orderId: order.id, idempotencyKey, items };
    const result = mode === 'admin' ? await createApprovedOrderAdditionAction(input) : await submitOrderAdditionAction(input);
    if (result.ok) {
      router.push(returnHref);
      return;
    }
    setPending(false);
    setError(result.error);
    if (result.code === 'STALE_VERSION') setIdempotencyKey(crypto.randomUUID());
  }

  return (
    <main id="main-content" tabIndex={-1} className="app-surface min-h-screen pb-16 text-black">
      <header className="sticky top-0 z-30 border-b border-black/10 bg-white/95 px-3 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-black/60">{mode === 'admin' ? 'תוספת שאושרה בטלפון' : 'בקשת תוספת'} · הזמנה {formatOrderNumber(order.orderNumber)}</p>
            <h1 className="text-xl font-semibold">הוספת פריטים להזמנה</h1>
          </div>
          <Button href={returnHref} variant="secondary" size="sm" icon={<ArrowRight size={14} />}>חזרה להזמנה</Button>
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-5xl space-y-4 px-3 md:px-6">
        <Notice tone="warning">
          {mode === 'admin'
            ? 'הפריטים יתווספו להזמנה מיד כתוספת מאושרת.'
            : 'אפשר רק להוסיף פריטים (לא להפחית). התוספת מצטרפת להזמנה אחרי אישור הצוות.'}
          {' '}תנאי התשלום נשארים {paymentTermLabels[order.paymentTerm]}.
        </Notice>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="space-y-3">
            <label className="flex h-10 items-center gap-2 rounded-md border border-[var(--pantry-line)] bg-white px-3 focus-within:ring-2 focus-within:ring-black/20">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">חיפוש מוצר להוספה</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="חיפוש מוצר להוספה…" />
            </label>
            <ul className="ui-panel divide-y divide-[var(--pantry-line)]">
              {visibleProducts.map((product) => (
                <li key={product.id} className="grid grid-cols-[3.5rem_1fr] gap-3 p-2.5 sm:grid-cols-[3.5rem_1fr_10rem] sm:items-center">
                  <ProductImage product={product} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{product.name}</p>
                    <p className="text-xs text-black/60">{formatMoney(product.price)} · {product.unit}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <QuantityStepper
                      value={cart[product.id] ?? 0}
                      min={getMinimumQuantity(product)}
                      step={getOrderMultiple(product)}
                      onChange={(quantity) => setCart((current) => setCartQuantity(current, product.id, quantity))}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside className="ui-panel h-fit space-y-3 p-4 lg:sticky lg:top-24">
            <p className="text-sm font-semibold">סיכום התוספת · {items.reduce((sum, item) => sum + item.quantity, 0)} יח׳</p>
            <OrderFinancialSummary totals={totals} />
            {error && <Notice tone="danger">{error}</Notice>}
            <Button fullWidth size="lg" onClick={submit} disabled={items.length === 0} pending={pending} pendingLabel="שומרים…">
              {mode === 'admin' ? 'הוספה להזמנה' : initialLines.length > 0 ? 'עדכון בקשת התוספת' : 'שליחת בקשת תוספת'}
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
          </aside>
        </div>
      </div>
    </main>
  );
}
