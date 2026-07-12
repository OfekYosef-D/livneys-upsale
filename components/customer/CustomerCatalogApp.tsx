'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CartAdjustmentNotice } from '@/components/customer/CartAdjustmentNotice';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { fallbackProductImage, productImages, brandLogo } from '@/lib/product-assets';
import { money } from '@/lib/format';
import {
  filterCatalogProducts,
  getAllowedProductIds,
  getCartItems,
  getCartPricingSummary,
  prepareCustomerCart,
  REMOVED_UNAVAILABLE_CART_ITEMS_MESSAGE,
  setCartQuantity,
  type Cart,
} from '@/lib/order-utils';
import { saveDraftOrderAction } from '@/features/customer-portal/actions';
import type { PortalCustomer, PortalOrder, PortalProduct, PortalRoute } from '@/features/customer-portal/types';

export function CustomerCatalogApp({
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
  const [cart, setCart] = useState<Cart>(preparedCart.cart);
  const [cartNotice, setCartNotice] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [error, setError] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);

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

  useEffect(() => {
    if (category !== 'all' && !products.some((product) => product.category === category)) {
      setCategory('all');
    }
  }, [category, products]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const visibleProducts = useMemo(
    () => filterCatalogProducts(products, { category, query, segment: 'all' }),
    [category, products, query],
  );
  const cartItems = useMemo(() => getCartItems(cart, allowedProductIds), [allowedProductIds, cart]);
  const cartPricing = useMemo(() => getCartPricingSummary(cart, products), [cart, products]);
  const itemCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const deliveryDate = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' }).format(new Date(route.nextDelivery));

  async function reviewOrder() {
    setError('');
    setIsSavingDraft(true);
    const result = await saveDraftOrderAction({ customerId: customer.id, items: cartItems });
    setIsSavingDraft(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/customer/${customer.id}/review`);
  }

  return (
    <main className="app-surface min-h-screen pb-24 text-black">
      <section className="sticky top-0 z-30 border-b border-black/10 bg-white/96 px-3 py-2.5 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/10 bg-[#e6e1d8]">
              <Image src={brandLogo} alt="Livney's" className="w-8" priority />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{customer.name}</p>
              <p className="truncate text-xs font-bold text-black/50">חלוקה {deliveryDate} · עד {route.deadline}</p>
            </div>
          </div>
          <button
            onClick={reviewOrder}
            className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-black px-3 text-xs font-black text-white focus-visible:ring-2 focus-visible:ring-black/30"
            aria-label="פתח סל הזמנה"
          >
            <ShoppingBag size={16} />
            <span className="hidden sm:inline">{itemCount} יח׳</span>
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-3 py-3 md:px-6">
        <section className="space-y-3">
          <div className="sticky top-[61px] z-20 rounded-2xl border border-black/10 bg-white/96 p-2 shadow-sm backdrop-blur">
            <div className="flex h-10 items-center gap-2 rounded-full bg-[#e6e1d8] px-3 focus-within:ring-2 focus-within:ring-black/25">
              <Search size={16} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="חיפוש מוצר…"
                aria-label="חיפוש מוצר"
                className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-black/45"
              />
            </div>
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                    category === item ? 'bg-black text-white' : 'bg-white text-black/60 ring-1 ring-black/10'
                  } focus-visible:ring-2 focus-visible:ring-black/25`}
                >
                  {item === 'all' ? 'כל הקטגוריות' : item}
                </button>
              ))}
            </div>
          </div>

          {cartNotice && <CartAdjustmentNotice message={cartNotice} />}

          <section className="space-y-2">
            {visibleProducts.map((product) => (
              <ProductOrderCard
                key={product.id}
                product={product}
                qty={cart[product.id] ?? 0}
                onQty={(qty) => setCart((current) => setCartQuantity(current, product.id, qty))}
              />
            ))}
          </section>

          {visibleProducts.length === 0 && (
            <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
              <h2 className="text-xl font-black">לא נמצאו מוצרים</h2>
              <p className="mt-2 text-black/55">נסו להסיר סינון או לחפש לפי שם אחר.</p>
            </div>
          )}
          {error && <p className="rounded-xl bg-white p-3 text-sm font-black text-red-700 ring-1 ring-red-200">{error}</p>}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/96 p-2.5 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <CartSummary itemCount={itemCount} pricing={cartPricing} cartItems={cartItems} onReview={reviewOrder} isSaving={isSavingDraft} />
        </div>
      </div>
    </main>
  );
}

function ProductOrderCard({ product, qty, onQty }: { product: PortalProduct; qty: number; onQty: (qty: number) => void }) {
  const image = product.imageUrl?.startsWith('http') ? product.imageUrl : productImages[product.assetImage ?? ''] ?? fallbackProductImage;
  const step = product.orderMultiple ?? product.minQty ?? 1;

  return (
    <article className="group rounded-2xl border border-black/10 bg-white p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.045)] transition hover:border-black/20">
      <div className="grid grid-cols-[5.25rem_1fr] gap-3 md:grid-cols-[6rem_1fr_12rem] md:items-center">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-[#e6e1d8]">
          <Image src={image} alt={product.name} fill sizes="96px" className="object-cover transition duration-300 group-hover:scale-[1.025]" />
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black text-black/45">{product.category}</p>
              <h2 className="mt-0.5 truncate text-base font-black leading-tight md:text-lg">{product.name}</h2>
              <p className="mt-0.5 line-clamp-1 text-xs font-bold text-black/55">{product.unit} · {product.caseSize}</p>
            </div>
            <div className="shrink-0 text-left md:hidden">
              {product.listPrice > product.price && <p className="text-[11px] font-bold text-black/40 line-through">{money(product.listPrice)}</p>}
              <p className="text-sm font-black">{money(product.price)}</p>
              <p className="text-[11px] font-bold text-black/45">ליחידה</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {product.promoLabel && <span className="rounded-full bg-black px-2 py-1 text-[11px] font-black text-white">{product.promoLabel}</span>}
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-black/45 ring-1 ring-black/10">מינ׳ {step}</span>
          </div>
          {product.promotion && <p className="mt-1 line-clamp-1 text-[11px] font-bold text-black/45">{product.promotion.description}</p>}
        </div>

        <div className="col-span-2 grid grid-cols-[1fr_9.5rem] items-center gap-3 md:col-span-1 md:grid-cols-1">
          <div className="hidden text-left md:block">
            {product.listPrice > product.price && <p className="text-xs font-bold text-black/40 line-through">{money(product.listPrice)}</p>}
            <p className="text-base font-black">{money(product.price)}</p>
            <p className="text-[11px] font-bold text-black/45">{product.unit}</p>
          </div>
          <QuantityStepper value={qty} min={product.minQty ?? step} step={step} onChange={onQty} />
        </div>
      </div>
    </article>
  );
}

function CartSummary({
  itemCount,
  pricing,
  cartItems,
  onReview,
  isSaving,
}: {
  itemCount: number;
  pricing: { subtotal: number; discountTotal: number; total: number };
  cartItems: { productId: string; qty: number }[];
  onReview: () => void;
  isSaving: boolean;
}) {
  const cartTotal = pricing.total;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-2.5 shadow-[0_-10px_32px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-black text-black/45">
            <Truck size={13} />
            {itemCount === 0 ? 'הוסיפו מוצרים לסל' : 'מוכן לשליחה'}
          </p>
          <p className="text-base font-black">{itemCount} יח׳ · {money(cartTotal)}</p>
        </div>
        {pricing.discountTotal > 0 && <p className="text-[11px] font-black text-emerald-700">חיסכון {money(pricing.discountTotal)}</p>}
        <button
          onClick={onReview}
          disabled={cartItems.length === 0 || isSaving}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:bg-black/30"
        >
          <ShoppingBag size={16} />
          {isSaving ? 'שומר…' : 'סקירת הזמנה'}
        </button>
      </div>
    </div>
  );
}
