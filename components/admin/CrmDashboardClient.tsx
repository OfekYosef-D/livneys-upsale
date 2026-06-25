'use client';

import Link from 'next/link';
import { Check, ClipboardList, Phone, TrendingUp, Truck, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CrmStatusBadge } from '@/components/admin/CrmStatusBadge';
import { money, type Customer, type Order, type Product, type Promotion, type Route } from '@/lib/mock-data';
import {
  buildCrmOrders,
  getCrmKpis,
  getCustomerSignals,
  getRouteReadiness,
  getSalesOpportunities,
  type CrmDemoState,
  type CrmOrder,
  type CrmOrderStatus,
} from '@/lib/crm-utils';
import { dismissOpportunity, markCustomerContacted, readCrmState, setOrderStatus, writeCrmState } from '@/lib/crm-state';

export function CrmDashboardClient({
  customers,
  orders,
  routes,
  products,
  promotions,
}: {
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

  const crmOrders = useMemo(() => buildCrmOrders({ orders, customers, routes, products, state }), [customers, orders, products, routes, state]);
  const signals = useMemo(() => getCustomerSignals({ customers, orders, state }), [customers, orders, state]);
  const opportunities = useMemo(() => getSalesOpportunities({ customers, orders, products, promotions, state }), [customers, orders, products, promotions, state]);
  const readiness = useMemo(() => getRouteReadiness({ routes, customers, crmOrders }), [customers, crmOrders, routes]);
  const kpis = useMemo(() => getCrmKpis({ crmOrders, signals, opportunities, readiness }), [crmOrders, opportunities, readiness, signals]);
  const activeOrders = crmOrders.filter((order) => order.status !== 'completed');

  return (
    <div className="space-y-4">
      <section className="grid gap-2 md:grid-cols-5">
        <KpiCard label="הזמנות פתוחות" value={kpis.openOrders} icon={<ClipboardList size={17} />} />
        <KpiCard label="לאישור" value={kpis.needsApproval} icon={<Check size={17} />} strong />
        <KpiCard label="מוכנים לקו" value={kpis.readyForRoute} icon={<Truck size={17} />} />
        <KpiCard label="מעקבים" value={kpis.followUps} icon={<Phone size={17} />} />
        <KpiCard label="אפסייל" value={kpis.opportunities} icon={<TrendingUp size={17} />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_.9fr]">
        <div className="rounded-2xl border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
            <h2 className="text-base font-black">תור הזמנות</h2>
            <span className="text-xs font-bold text-black/45">{activeOrders.length} לטיפול</span>
          </div>
          <div className="divide-y divide-black/10">
            {activeOrders.map((order) => (
              <OrderQueueRow
                key={order.id}
                order={order}
                onAction={() => updateState(setOrderStatus(state, order.id, getNextStatus(order.status)))}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Panel title="מוכנות קווים">
            <div className="space-y-2">
              {readiness.map((route) => (
                <Link key={route.routeId} href={`/admin/routes/${route.routeId}`} className="block rounded-xl bg-[#e6e1d8] p-3 hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25">
                  <div className="flex items-center justify-between text-sm font-black">
                    <span>קו {route.routeName}</span>
                    <span>{route.readinessPercent}%</span>
                  </div>
                  <p className="mt-1 text-xs font-bold opacity-70">
                    {route.readyCount} מוכנים · {route.actionRequiredCount} לטיפול · {route.missingOrderCount} חסרים
                  </p>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="לקוחות למעקב">
            <div className="space-y-2">
              {signals.map((signal) => (
                <div key={signal.id} className={`rounded-xl border border-black/10 p-3 ${signal.isDone ? 'bg-black/5 text-black/45' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/admin/customers/${signal.customerId}`} className="text-sm font-black hover:underline">
                        {signal.customerName}
                      </Link>
                      <p className="text-xs font-bold text-black/55">{signal.reason}</p>
                    </div>
                    <button
                      onClick={() => updateState(markCustomerContacted(state, signal.customerId))}
                      disabled={signal.isDone}
                      className="rounded-full bg-black px-3 py-1.5 text-[11px] font-black text-white disabled:bg-black/20"
                    >
                      {signal.isDone ? 'טופל' : signal.suggestedAction}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      <Panel title="הזדמנויות מכירה">
        <div className="grid gap-2 md:grid-cols-3">
          {opportunities.map((opportunity) => (
            <article key={opportunity.id} className="rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-black/45">{opportunity.promotionTitle}</p>
                  <h3 className="text-sm font-black">{opportunity.customerName}</h3>
                </div>
                <button
                  onClick={() => updateState(dismissOpportunity(state, opportunity.id))}
                  className="grid h-7 w-7 place-items-center rounded-full bg-[#e6e1d8] hover:bg-black hover:text-white"
                  aria-label="הסתר הזדמנות"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="mt-2 text-xs font-bold leading-5 text-black/58">
                הציעו {opportunity.productName}. פוטנציאל: {money(opportunity.potentialValue)}
              </p>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function KpiCard({ label, value, icon, strong = false }: { label: string; value: number; icon: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border border-black/10 p-3 ${strong ? 'bg-black text-white' : 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-black ${strong ? 'text-white/60' : 'text-black/45'}`}>{label}</p>
        <div className={`grid h-8 w-8 place-items-center rounded-full ${strong ? 'bg-white text-black' : 'bg-[#e6e1d8]'}`}>{icon}</div>
      </div>
      <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-3">
      <h2 className="mb-3 text-base font-black">{title}</h2>
      {children}
    </section>
  );
}

function OrderQueueRow({ order, onAction }: { order: CrmOrder; onAction: () => void }) {
  return (
    <div className="grid gap-3 px-3 py-2.5 md:grid-cols-[1fr_7rem_7rem_7rem_7.5rem] md:items-center">
      <div className="min-w-0">
        <Link href={`/admin/orders/${order.id}`} className="truncate text-sm font-black hover:underline">
          {order.customerName}
        </Link>
        <p className="truncate text-xs font-bold text-black/50">קו {order.routeName} · דדליין {order.deadline}</p>
      </div>
      <CrmStatusBadge status={order.status} />
      <p className="text-sm font-black tabular-nums">{money(order.total)}</p>
      <Link href={`/admin/customers/${order.customerId}`} className="text-xs font-black text-black/55 underline-offset-2 hover:underline">
        לקוח
      </Link>
      <button
        onClick={onAction}
        disabled={order.status === 'completed'}
        className="rounded-full bg-black px-3 py-2 text-xs font-black text-white disabled:bg-black/20"
      >
        {order.nextAction}
      </button>
    </div>
  );
}

function getNextStatus(status: CrmOrderStatus): CrmOrderStatus {
  if (status === 'new' || status === 'needs_review') return 'approved';
  if (status === 'approved') return 'packed';
  if (status === 'packed') return 'completed';
  return 'completed';
}
