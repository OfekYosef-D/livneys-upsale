'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { fallbackProductImage, productImages, brandLogo } from '@/lib/product-assets';
import { money, type Customer, type Order, type Product, type Route } from '@/lib/mock-data';
import {
  buildCartFromOrder,
  filterCatalogProducts,
  getCartItems,
  getCartTotal,
  setCartQuantity,
  type Cart,
} from '@/lib/order-utils';
import { readStoredCart, writeStoredCart } from '@/lib/cart-storage';

export function CustomerCatalogApp({
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
  const router = useRouter();
  const initialCart = useMemo(() => buildCartFromOrder(lastOrder.items), [lastOrder.items]);
  const [cart, setCart] = useState<Cart>(initialCart);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    const stored = readStoredCart(customer.id);
    if (stored) {
      setCart(stored);
    }
  }, [customer.id]);

  useEffect(() => {
    writeStoredCart(customer.id, cart);
  }, [cart, customer.id]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const visibleProducts = useMemo(
    () => filterCatalogProducts(products, { category, query, segment: 'all' }),
    [category, products, query],
  );
  const cartItems = useMemo(() => getCartItems(cart), [cart]);
  const cartTotal = useMemo(() => getCartTotal(cart, products), [cart, products]);
  const itemCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const deliveryDate = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' }).format(new Date(route.nextDelivery));

  function reviewOrder() {
    writeStoredCart(customer.id, cart);
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
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/96 p-2.5 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <CartSummary itemCount={itemCount} cartTotal={cartTotal} cartItems={cartItems} onReview={reviewOrder} />
        </div>
      </div>
    </main>
  );
}

function ProductOrderCard({ product, qty, onQty }: { product: Product; qty: number; onQty: (qty: number) => void }) {
  const image = productImages[product.assetImage] ?? fallbackProductImage;
  const step = product.minQty ?? 1;

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
              <p className="text-sm font-black">{money(product.price)}</p>
              <p className="text-[11px] font-bold text-black/45">ליח׳</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {product.promoLabel && <span className="rounded-full bg-black px-2 py-1 text-[11px] font-black text-white">{product.promoLabel}</span>}
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-black/45 ring-1 ring-black/10">מינ׳ {step}</span>
          </div>
        </div>

        <div className="col-span-2 grid grid-cols-[1fr_9.5rem] items-center gap-3 md:col-span-1 md:grid-cols-1">
          <div className="hidden text-left md:block">
            <p className="text-base font-black">{money(product.price)}</p>
            <p className="text-[11px] font-bold text-black/45">{product.unit}</p>
          </div>
          <QuantityStepper value={qty} min={step} step={1} onChange={onQty} />
        </div>
      </div>
    </article>
  );
}

function CartSummary({
  itemCount,
  cartTotal,
  cartItems,
  onReview,
}: {
  itemCount: number;
  cartTotal: number;
  cartItems: { productId: string; qty: number }[];
  onReview: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-2.5 shadow-[0_-10px_32px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-black text-black/45">
            <Truck size={13} />
            עד {itemCount === 0 ? 'להוספת מוצרים' : 'לשליחה'}
          </p>
          <p className="text-base font-black">{itemCount} יח׳ · {money(cartTotal)}</p>
        </div>
        <button
          onClick={onReview}
          disabled={cartItems.length === 0}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:bg-black/30"
        >
          <ShoppingBag size={16} />
          סקירה
        </button>
      </div>
    </div>
  );
}
