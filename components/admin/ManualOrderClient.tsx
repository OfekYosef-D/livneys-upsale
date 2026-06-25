'use client';

import { Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { money, type Customer, type Product } from '@/lib/mock-data';

export function ManualOrderClient({ customers, products }: { customers: Customer[]; products: Product[] }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? customers[0];
  const items = useMemo(
    () =>
      products
        .map((product) => ({ product, qty: quantities[product.id] ?? 0 }))
        .filter((item) => item.qty > 0),
    [products, quantities],
  );
  const orderTotal = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_.75fr]">
      <section className="rounded-2xl border border-black/10 bg-white">
        <div className="grid gap-3 border-b border-black/10 px-3 py-3 md:grid-cols-[1fr_1fr]">
          <label className="block">
            <span className="text-xs font-black text-black/45">לקוח</span>
            <select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-black outline-none focus:ring-2 focus:ring-black/20"
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.region}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black text-black/45">הערות להזמנה</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-black/20"
              placeholder="לדוגמה: התקבלה בוואטסאפ"
            />
          </label>
        </div>

        <div className="divide-y divide-black/10">
          {products.map((product) => (
            <div key={product.id} className="grid gap-3 px-3 py-2.5 md:grid-cols-[1fr_7rem_7rem_9rem] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{product.name}</p>
                <p className="truncate text-xs font-bold text-black/45">{product.sku} · {product.caseSize}</p>
              </div>
              <p className="text-sm font-black tabular-nums">{money(product.price)}</p>
              <p className="text-xs font-bold text-black/50">מינימום {product.minQty}</p>
              <QuantityStepper
                value={quantities[product.id] ?? 0}
                min={product.minQty ?? 1}
                step={product.minQty ?? 1}
                onChange={(value) => {
                  setSaved(false);
                  setQuantities((current) => ({ ...current, [product.id]: value }));
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="sticky top-20 rounded-2xl border border-black/10 bg-white p-3">
          <h2 className="text-base font-black">סיכום</h2>
          <p className="mt-1 text-sm font-bold text-black/55">{selectedCustomer?.contact} · {selectedCustomer?.phone}</p>
          <div className="mt-3 divide-y divide-black/10">
            {items.length === 0 ? (
              <p className="py-4 text-sm font-bold text-black/45">לא נבחרו פריטים.</p>
            ) : (
              items.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-bold">{item.product.name}</span>
                  <span className="font-black tabular-nums">{item.qty}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#e6e1d8] px-3 py-2">
            <span className="text-sm font-black">סה״כ</span>
            <span className="text-xl font-black tabular-nums">{money(orderTotal)}</span>
          </div>
          <button
            onClick={() => setSaved(true)}
            disabled={items.length === 0}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-black text-sm font-black text-white disabled:bg-black/10 disabled:text-black/35"
          >
            <Save size={16} />
            שמור הזמנה בדמו
          </button>
          {saved && (
            <p className="mt-3 rounded-xl bg-[#e6e1d8] p-3 text-sm font-black">
              ההזמנה נשמרה מקומית לתצוגה. חיבור למערכת אמיתית יגיע בשלב הבא.
            </p>
          )}
          {notes && <p className="mt-3 text-xs font-bold leading-5 text-black/50">הערה: {notes}</p>}
        </section>
      </aside>
    </div>
  );
}
