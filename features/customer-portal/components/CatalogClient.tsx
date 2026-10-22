'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, History, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, Notice } from '@/components/ui/Notice';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { formatShortDateTime, formatWeekdayDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { paths } from '@/lib/paths';
import { filterCatalog } from '../../cart/cart';
import { useCart } from '../../cart/useCart';
import { ProductImage } from '../../catalog/components/ProductImage';
import { getOrderMultiple, getMinimumQuantity } from '../../orders/quantity';
import { calculateVat } from '../../orders/totals';
import { INSTITUTIONAL_PRICING_NOTICE } from '../../owner-rules/constants';
import { saveDraftOrderAction } from '../actions';
import type { CustomerPortalData, PortalProduct } from '../types';
import { CustomerHeader } from './CustomerHeader';
import { MinimumOrderProgress } from './MinimumOrderProgress';

type Segment = 'all' | 'previous' | 'recommended' | 'promotions';

const segments: Array<{ value: Segment; label: string; matches: (product: PortalProduct) => boolean }> = [
  { value: 'all', label: 'כל המוצרים', matches: () => true },
  { value: 'previous', label: 'הזמנתם בעבר', matches: (product) => product.isPreviousOrder },
  { value: 'recommended', label: 'מומלץ עבורכם', matches: (product) => product.isRecommended },
  { value: 'promotions', label: 'במבצע', matches: (product) => Boolean(product.promoLabel) },
];

export function CatalogClient({ data }: { data: CustomerPortalData }) {
  const router = useRouter();
  const { customer, schedule, products } = data;
  const cart = useCart(data.cartSeed, products);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [segment, setSegment] = useState<Segment>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(products.map((product) => product.category))], [products]);
  const availableSegments = segments.filter((option) => option.value === 'all' || products.some(option.matches));
  const visibleProducts = useMemo(() => {
    const matcher = segments.find((option) => option.value === segment)!.matches;
    return filterCatalog(products, { category, query }).filter(matcher);
  }, [category, products, query, segment]);
  const vat = calculateVat(cart.pricing.total, data.vatRatePercent);

  async function continueToReview() {
    setError(null);
    setSaving(true);
    const result = await saveDraftOrderAction({ customerId: customer.id, items: cart.items });
    if (result.ok) {
      router.push(paths.customer.review(customer.id));
      return;
    }
    setSaving(false);
    if (result.code === 'ACTIVE_ORDER_EXISTS' && typeof result.details?.orderNumber === 'number') {
      router.push(paths.customer.order(customer.id, result.details.orderNumber));
      return;
    }
    setError(result.error);
  }

  return (
    <main id="main-content" tabIndex={-1} className="app-surface min-h-screen pb-40 text-black">
      <CustomerHeader
        title={customer.name}
        subtitle={`חלוקה ב${formatWeekdayDate(schedule.deliveryAt)} · הזמנה עד ${formatShortDateTime(schedule.cutoffAt)}`}
      />

      <div className="mx-auto max-w-5xl space-y-3 px-3 py-3 md:px-6">
        {schedule.isPastCutoff && (
          <Notice tone="warning" icon={<AlertTriangle size={16} />} title="מועד ההזמנה לחלוקה הקרובה עבר">
            עדיין אפשר לשלוח הזמנה – היא תטופל כבקשה מיוחדת והצוות יאשר אם ניתן לספק אותה.
          </Notice>
        )}
        {cart.seedNotice && <Notice tone="info" icon={<History size={16} />}>{cart.seedNotice}</Notice>}
        {cart.adjustmentNotice && <Notice tone="warning">{cart.adjustmentNotice}</Notice>}

        <div className="sticky top-[61px] z-20 -mx-3 space-y-2 border-b border-[var(--pantry-line)] bg-[var(--pantry-soft)] px-3 py-2 md:mx-0 md:px-0">
          <label className="flex h-10 items-center gap-2 rounded-md border border-[var(--pantry-line)] bg-white px-3 focus-within:ring-2 focus-within:ring-black/20">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">חיפוש מוצר</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש מוצר…" className="w-full bg-transparent text-sm outline-none placeholder:text-black/60" />
          </label>
          {availableSegments.length > 1 && (
            <ChipRow label="סינון" options={availableSegments} value={segment} onChange={setSegment} />
          )}
          {categories.length > 1 && (
            <ChipRow
              label="קטגוריה"
              options={[{ value: 'all', label: 'כל הקטגוריות' }, ...categories.map((item) => ({ value: item, label: item }))]}
              value={category}
              onChange={setCategory}
            />
          )}
        </div>

        <p className="text-xs text-black/60">{INSTITUTIONAL_PRICING_NOTICE}</p>

        {visibleProducts.length === 0 ? (
          <section className="ui-panel">
            <EmptyState title="לא נמצאו מוצרים" description="נסו להסיר סינון או לחפש בשם אחר." />
          </section>
        ) : (
          <section className="ui-panel divide-y divide-[var(--pantry-line)]">
            {visibleProducts.map((product) => (
              <ProductRow key={product.id} product={product} quantity={cart.cart[product.id] ?? 0} onQuantity={(quantity) => cart.setQuantity(product.id, quantity)} />
            ))}
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/97 px-3 py-2.5 backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-2">
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold tabular-nums">
                {formatMoney(cart.pricing.total)} <span className="text-xs font-medium text-black/60">לפני מע״מ · {cart.units} יח׳</span>
              </p>
              <p className="text-[11px] text-black/60">
                כולל מע״מ: <span className="font-semibold tabular-nums">{formatMoney(vat.totalIncludingVat)}</span>
                {cart.pricing.discountTotal > 0 && <span className="ms-2 font-semibold text-emerald-700">חיסכון {formatMoney(cart.pricing.discountTotal)}</span>}
              </p>
            </div>
            <Button onClick={continueToReview} disabled={cart.items.length === 0} pending={saving} pendingLabel="שומרים…" icon={<ShoppingBag size={16} />}>
              לסיכום ההזמנה
            </Button>
          </div>
          {cart.items.length > 0 && <MinimumOrderProgress totalBeforeVat={cart.pricing.total} />}
        </div>
      </div>
    </main>
  );
}

function ChipRow<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-black/25 ${value === option.value ? 'bg-black text-white' : 'text-black/65 hover:bg-white'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ProductRow({ product, quantity, onQuantity }: { product: PortalProduct; quantity: number; onQuantity: (quantity: number) => void }) {
  const multiple = getOrderMultiple(product);
  const minimum = getMinimumQuantity(product);

  return (
    <article className="grid grid-cols-[4.75rem_1fr] gap-3 p-3 md:grid-cols-[5.5rem_1fr_11rem] md:items-center">
      <ProductImage product={product} />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-black/60">{product.category}</p>
        <h2 className="truncate text-base font-semibold leading-tight">{product.name}</h2>
        <p className="mt-0.5 text-xs text-black/60">{product.unit} · {product.caseSize}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums">{formatMoney(product.price)}</span>
          {product.listPrice > product.price && <span className="text-xs text-black/60 line-through">{formatMoney(product.listPrice)}</span>}
          {product.promoLabel && <Badge tone="inverse">{product.promoLabel}</Badge>}
          {product.isRecommended && <Badge tone="info"><Sparkles size={11} className="me-1" aria-hidden="true" />מומלץ</Badge>}
          {product.stockLabel && <Badge tone="warning">{product.stockLabel}</Badge>}
        </div>
        <p className="mt-1 text-[11px] text-black/60">
          {multiple > 1 ? `בכפולות של ${multiple}` : `מינימום ${minimum}`}
          {product.promotion?.description ? ` · ${product.promotion.description}` : ''}
        </p>
      </div>
      <div className="col-span-2 md:col-span-1">
        <QuantityStepper value={quantity} min={minimum} step={multiple} onChange={onQuantity} />
      </div>
    </article>
  );
}
