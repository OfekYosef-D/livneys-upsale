'use client';

import Link from 'next/link';
import { MessageCircle, PhoneCall, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CrmStatusBadge } from '@/components/admin/CrmStatusBadge';
import { money, type Customer, type Order, type Product, type Promotion, type Route } from '@/lib/mock-data';
import { dismissOpportunity, markCustomerContacted, readCrmState, setInternalNote, writeCrmState } from '@/lib/crm-state';
import {
  buildCrmOrders,
  getCustomerSignals,
  getSalesOpportunities,
  type CrmDemoState,
} from '@/lib/crm-utils';

export function CrmCustomerProfileClient({
  customerId,
  customers,
  orders,
  routes,
  products,
  promotions,
}: {
  customerId: string;
  customers: Customer[];
  orders: Order[];
  routes: Route[];
  products: Product[];
  promotions: Promotion[];
}) {
  const [state, setState] = useState<CrmDemoState>({});

  useEffect(() => {
    setState(readCrmState());
  }, []);

  function updateState(nextState: CrmDemoState) {
    setState(nextState);
    writeCrmState(nextState);
  }

  const customer = customers.find((item) => item.id === customerId);
  const crmOrders = useMemo(() => buildCrmOrders({ orders, customers, routes, products, state }), [customers, orders, products, routes, state]);
  const signals = useMemo(() => getCustomerSignals({ customers, orders, state }).filter((signal) => signal.customerId === customerId), [customers, customerId, orders, state]);
  const opportunities = useMemo(
    () => getSalesOpportunities({ customers, orders, products, promotions, state }).filter((opportunity) => opportunity.customerId === customerId),
    [customers, customerId, orders, products, promotions, state],
  );
  const customerOrders = crmOrders.filter((order) => order.customerId === customerId);
  const route = customer ? routes.find((item) => item.id === customer.routeId) : undefined;
  const note = customer ? state.internalNotes?.[customer.id] ?? customer.notes : '';
  const activeSignals = signals.filter((signal) => !signal.isDone);

  if (!customer || !route) {
    return (
      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-lg font-black">לקוח לא נמצא</h2>
        <Link href="/admin" className="mt-3 inline-flex rounded-full bg-black px-4 py-2 text-sm font-black text-white">
          חזרה לדשבורד
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[.85fr_1.35fr]">
      <aside className="space-y-4">
        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-black/45">פרופיל לקוח</p>
              <h2 className="text-xl font-black">{customer.name}</h2>
            </div>
            {activeSignals.length > 0 && <span className="rounded-full bg-black px-2.5 py-1 text-[11px] font-black text-white">לטיפול</span>}
          </div>
          <dl className="mt-4 grid gap-2 text-sm">
            <InfoRow label="איש קשר" value={customer.contact} />
            <InfoRow label="טלפון" value={customer.phone} />
            <InfoRow label="אזור" value={customer.region} />
            <InfoRow label="קו" value={`${route.name} · ${route.deadline}`} />
            <InfoRow label="כתובת" value={customer.address} />
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href={`tel:${customer.phone}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-black text-xs font-black text-white">
              <PhoneCall size={15} />
              התקשר
            </a>
            <button
              onClick={() => updateState(markCustomerContacted(state, customer.id))}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#e6e1d8] text-xs font-black hover:bg-black hover:text-white"
            >
              <MessageCircle size={15} />
              סומן קשר
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <label htmlFor="customer-note" className="text-base font-black">הערת צוות</label>
          <textarea
            id="customer-note"
            value={note}
            onChange={(event) => updateState(setInternalNote(state, customer.id, event.target.value))}
            className="mt-2 min-h-32 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-bold leading-6 outline-none focus:ring-2 focus:ring-black/20"
          />
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <h3 className="text-base font-black">סימנים למעקב</h3>
          <div className="mt-2 space-y-2">
            {signals.length === 0 ? (
              <p className="text-sm font-bold text-black/45">אין מעקב פתוח כרגע.</p>
            ) : (
              signals.map((signal) => (
                <div key={signal.id} className={`rounded-xl border border-black/10 p-3 ${signal.isDone ? 'bg-black/5 text-black/45' : 'bg-white'}`}>
                  <p className="text-sm font-black">{signal.suggestedAction}</p>
                  <p className="text-xs font-bold text-black/55">{signal.reason}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </aside>

      <section className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Metric label="הזמנות" value={customerOrders.length.toString()} />
          <Metric label="סה״כ בדמו" value={money(customerOrders.reduce((sum, order) => sum + order.total, 0))} />
          <Metric label="הזדמנויות" value={opportunities.length.toString()} />
        </div>

        <section className="rounded-2xl border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
            <h3 className="text-base font-black">היסטוריית הזמנות</h3>
            <Link href="/admin/manual-order" className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-xs font-black text-white">
              <Plus size={14} />
              ידנית
            </Link>
          </div>
          <div className="divide-y divide-black/10">
            {customerOrders.map((order) => (
              <Link key={order.id} href={`/admin/orders/${order.id}`} className="grid gap-2 px-3 py-3 hover:bg-[#e6e1d8] sm:grid-cols-[1fr_7rem_6rem] sm:items-center">
                <div>
                  <p className="text-sm font-black">{order.id}</p>
                  <p className="text-xs font-bold text-black/45">{order.date}</p>
                </div>
                <CrmStatusBadge status={order.status} />
                <p className="text-sm font-black tabular-nums">{money(order.total)}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <h3 className="text-base font-black">הזדמנויות מכירה</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {opportunities.length === 0 ? (
              <p className="text-sm font-bold text-black/45">אין הזדמנות פתוחה ללקוח הזה.</p>
            ) : (
              opportunities.map((opportunity) => (
                <article key={opportunity.id} className="rounded-xl border border-black/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-black text-black/45">{opportunity.promotionTitle}</p>
                      <h4 className="text-sm font-black">{opportunity.productName}</h4>
                    </div>
                    <button
                      onClick={() => updateState(dismissOpportunity(state, opportunity.id))}
                      className="grid h-7 w-7 place-items-center rounded-full bg-[#e6e1d8] hover:bg-black hover:text-white"
                      aria-label="הסתר הזדמנות"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-black/55">{opportunity.rationale}</p>
                  <p className="mt-2 text-sm font-black">{money(opportunity.potentialValue)}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <dt className="font-black text-black/45">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3">
      <p className="text-xs font-black text-black/45">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}
