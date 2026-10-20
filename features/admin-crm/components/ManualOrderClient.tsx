'use client';

import { useRouter } from 'next/navigation';
import { Search, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useServerAction } from '@/components/hooks/useServerAction';
import { Button } from '@/components/ui/Button';
import { formValue, SelectField, TextAreaField } from '@/components/ui/Field';
import { ActionFeedback, EmptyState } from '@/components/ui/Notice';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { formatWeekdayDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { paths } from '@/lib/paths';
import { filterCatalog, getCartItems, priceCart, setCartQuantity, type Cart } from '../../cart/cart';
import { ProductImage } from '../../catalog/components/ProductImage';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { getMinimumQuantity, getOrderMultiple } from '../../orders/quantity';
import { calculateOrderTotals } from '../../orders/totals';
import { createManualOrderAction } from '../actions/orders';
import type { ManualOrderData } from '../queries';

const intakeOptions = [
  { value: 'PHONE', label: 'טלפון' },
  { value: 'WHATSAPP', label: 'וואטסאפ' },
  { value: 'ADMIN_MANUAL', label: 'אחר' },
];

export function ManualOrderClient({ data, initialCustomerId }: { data: ManualOrderData; initialCustomerId?: string }) {
  const router = useRouter();
  const action = useServerAction();
  const [customerId, setCustomerId] = useState(() =>
    data.customers.some((customer) => customer.id === initialCustomerId) ? initialCustomerId! : data.customers[0]?.id ?? '');
  const [cart, setCart] = useState<Cart>({});
  const [query, setQuery] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const customer = data.customers.find((item) => item.id === customerId) ?? null;
  const products = customer?.products ?? [];
  const visibleProducts = useMemo(() => filterCatalog(products, { category: 'all', query }), [products, query]);
  const pricing = priceCart(cart, products);
  const totals = calculateOrderTotals({ ...pricing, paymentTerm: 'NET_30', vatRatePercent: data.vatRatePercent });

  if (data.customers.length === 0) {
    return <Panel><EmptyState title="אין לקוחות פעילים" description="הוסיפו לקוח עם קו חלוקה פעיל כדי ליצור הזמנה ידנית." /></Panel>;
  }

  function submit(form: FormData) {
    action.run(
      () => createManualOrderAction({
        customerId,
        idempotencyKey,
        vatRatePercent: data.vatRatePercent,
        intakeChannel: formValue.text(form, 'intakeChannel'),
        notes: formValue.text(form, 'notes'),
        internalNote: formValue.text(form, 'internalNote'),
        items: getCartItems(cart),
      }),
      {
        refresh: false,
        onSuccess: (result) => router.push(paths.admin.order(result.orderId)),
        onError: (failure) => {
          if (failure.code === 'ACTIVE_ORDER_EXISTS' && typeof failure.details?.orderId === 'string') router.push(paths.admin.order(failure.details.orderId));
        },
      },
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Panel className="h-fit xl:sticky xl:top-4">
        <form
          className="space-y-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit(new FormData(event.currentTarget));
          }}
        >
          <label className="block">
            <span className="ui-label">לקוח</span>
            <select
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setCart({});
                setIdempotencyKey(crypto.randomUUID());
              }}
              className="ui-field"
            >
              {data.customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {customer && (
            <p className="rounded-md bg-[var(--pantry-soft)] p-2.5 text-xs leading-5">
              {customer.contact} · <span dir="ltr">{customer.phone}</span><br />
              קו {customer.routeName} · {customer.priceListName}<br />
              חלוקה ב{formatWeekdayDate(customer.deliveryAt)}
            </p>
          )}
          <SelectField name="intakeChannel" label="איך התקבלה ההזמנה" options={intakeOptions} />
          <TextAreaField name="notes" label="הערה (תוצג ללקוח)" rows={2} />
          <TextAreaField name="internalNote" label="הערה פנימית" rows={2} />
          <OrderFinancialSummary totals={totals} />
          <p className="text-[11px] text-black/50">הזמנה ידנית אינה כפופה למינימום ההזמנה. הלקוח יקבל אישור במייל.</p>
          <ActionFeedback feedback={action.feedback} />
          <Button type="submit" fullWidth disabled={pricing.lines.length === 0} pending={action.pending} pendingLabel="יוצרים הזמנה…" icon={<ShoppingCart size={16} />}>
            יצירת הזמנה ({pricing.lines.length} שורות)
          </Button>
        </form>
      </Panel>

      <Panel>
        <PanelHeader
          title="מוצרים"
          actions={(
            <label className="relative w-60 max-w-full">
              <span className="sr-only">חיפוש מוצר</span>
              <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35" size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש מוצר…" className="ui-field min-h-9 bg-[var(--pantry-soft)] pr-9" />
            </label>
          )}
        />
        <ul className="divide-y divide-[var(--pantry-line)]">
          {visibleProducts.map((product) => (
            <li key={product.id} className="grid grid-cols-[2.5rem_1fr] items-center gap-3 px-3 py-2 sm:grid-cols-[2.5rem_1fr_9.5rem]">
              <ProductImage product={product} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{product.name}</p>
                <p className="text-xs text-black/55">
                  {formatMoney(product.price)}
                  {product.promoLabel ? ` · ${product.promoLabel}` : ''} · מינימום {getMinimumQuantity(product)}
                  {getOrderMultiple(product) > 1 ? ` · בכפולות ${getOrderMultiple(product)}` : ''}
                </p>
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
      </Panel>
    </div>
  );
}
