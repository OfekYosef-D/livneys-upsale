'use client';

import Link from 'next/link';
import { ClipboardList, PackageCheck, Plus, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CrmStatusBadge } from '@/components/admin/CrmStatusBadge';
import { hebDate, money, type Customer, type Order, type Product, type Route } from '@/lib/mock-data';
import { readCrmState, setOrderStatus, writeCrmState } from '@/lib/crm-state';
import {
  buildCrmOrders,
  getRouteReadiness,
  type CrmDemoState,
  type CrmOrder,
  type CrmOrderStatus,
} from '@/lib/crm-utils';

export function CrmRouteDetailClient({
  routeId,
  customers,
  orders,
  routes,
  products,
}: {
  routeId: string;
  customers: Customer[];
  orders: Order[];
  routes: Route[];
  products: Product[];
}) {
  const [state, setState] = useState<CrmDemoState>({});

  useEffect(() => {
    setState(readCrmState());
  }, []);

  function updateState(nextState: CrmDemoState) {
    setState(nextState);
    writeCrmState(nextState);
  }

  const route = routes.find((item) => item.id === routeId);
  const crmOrders = useMemo(() => buildCrmOrders({ orders, customers, routes, products, state }), [customers, orders, products, routes, state]);
  const readiness = useMemo(() => getRouteReadiness({ routes, customers, crmOrders }).find((item) => item.routeId === routeId), [customers, crmOrders, routeId, routes]);
  const routeCustomers = route ? customers.filter((customer) => route.customerIds.includes(customer.id)) : [];

  if (!route || !readiness) {
    return (
      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-lg font-black">קו לא נמצא</h2>
        <Link href="/admin" className="mt-3 inline-flex rounded-full bg-black px-4 py-2 text-sm font-black text-white">
          חזרה לדשבורד
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_.75fr]">
      <section className="rounded-2xl border border-black/10 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-3 py-3">
          <div>
            <p className="text-xs font-black text-black/45">חלוקה {hebDate(route.nextDelivery)}</p>
            <h2 className="text-xl font-black">קו {route.name}</h2>
            <p className="text-sm font-bold text-black/55">נהג {route.driver} · דדליין {route.deadline}</p>
          </div>
          <div className="rounded-full bg-black px-3 py-1.5 text-sm font-black text-white">{readiness.readinessPercent}% מוכנות</div>
        </div>

        <div className="divide-y divide-black/10">
          {routeCustomers.map((customer) => {
            const latestOrder = getLatestActiveOrder(crmOrders, customer.id);

            return (
              <div key={customer.id} className="grid gap-3 px-3 py-3 lg:grid-cols-[1fr_8rem_7rem_8rem] lg:items-center">
                <div className="min-w-0">
                  <Link href={`/admin/customers/${customer.id}`} className="truncate text-sm font-black hover:underline">
                    {customer.name}
                  </Link>
                  <p className="truncate text-xs font-bold text-black/50">{customer.contact} · {customer.phone} · {customer.address}</p>
                </div>

                {latestOrder ? (
                  <>
                    <CrmStatusBadge status={latestOrder.status} />
                    <p className="text-sm font-black tabular-nums">{money(latestOrder.total)}</p>
                    <button
                      onClick={() => updateState(setOrderStatus(state, latestOrder.id, getNextStatus(latestOrder.status)))}
                      disabled={latestOrder.status === 'completed'}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-black px-3 text-xs font-black text-white disabled:bg-black/10 disabled:text-black/35"
                    >
                      {latestOrder.status === 'packed' ? <Truck size={15} /> : <PackageCheck size={15} />}
                      {latestOrder.nextAction}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="inline-flex w-fit rounded-full bg-[#e6e1d8] px-2.5 py-1 text-[11px] font-black">אין הזמנה</span>
                    <span className="text-sm font-bold text-black/45">צריך תזכורת</span>
                    <Link href="/admin/manual-order" className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-black px-3 text-xs font-black text-white">
                      <Plus size={15} />
                      הזמנה
                    </Link>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <h3 className="text-base font-black">סיכום קו</h3>
          <div className="mt-3 grid gap-2">
            <RouteMetric label="לקוחות בקו" value={readiness.totalCustomers} />
            <RouteMetric label="מוכנים" value={readiness.readyCount} />
            <RouteMetric label="דורש טיפול" value={readiness.actionRequiredCount} />
            <RouteMetric label="חסרה הזמנה" value={readiness.missingOrderCount} />
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <h3 className="text-base font-black">סדר עבודה</h3>
          <ol className="mt-3 space-y-2 text-sm font-bold text-black/60">
            <li className="flex gap-2"><ClipboardList size={16} /> אשר הזמנות חדשות.</li>
            <li className="flex gap-2"><PackageCheck size={16} /> סמן נארז רק אחרי בדיקת מלאי.</li>
            <li className="flex gap-2"><Truck size={16} /> סמן חולק בסוף המסלול.</li>
          </ol>
        </section>
      </aside>
    </div>
  );
}

function RouteMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#e6e1d8] px-3 py-2">
      <span className="text-sm font-black">{label}</span>
      <span className="text-lg font-black tabular-nums">{value}</span>
    </div>
  );
}

function getLatestActiveOrder(orders: CrmOrder[], customerId: string): CrmOrder | undefined {
  return orders
    .filter((order) => order.customerId === customerId && order.status !== 'completed')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

function getNextStatus(status: CrmOrderStatus): CrmOrderStatus {
  if (status === 'new' || status === 'needs_review') return 'approved';
  if (status === 'approved') return 'packed';
  if (status === 'packed') return 'completed';
  return status;
}
