'use client';

import Link from 'next/link';
import { Check, ClipboardList, PackageCheck, Truck } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CrmStatusBadge } from '@/components/admin/CrmStatusBadge';
import { money, type Customer, type Order, type Product, type Route } from '@/lib/mock-data';
import { readCrmState, setInternalNote, setOrderStatus, writeCrmState } from '@/lib/crm-state';
import {
  buildCrmOrders,
  type CrmDemoState,
} from '@/lib/crm-utils';

export function CrmOrderDetailClient({
  orderId,
  customers,
  orders,
  routes,
  products,
}: {
  orderId: string;
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

  const crmOrders = useMemo(() => buildCrmOrders({ orders, customers, routes, products, state }), [customers, orders, products, routes, state]);
  const order = crmOrders.find((item) => item.id === orderId);
  const sourceOrder = orders.find((item) => item.id === orderId);
  const customer = order ? customers.find((item) => item.id === order.customerId) : undefined;
  const route = customer ? routes.find((item) => item.id === customer.routeId) : undefined;
  const note = customer ? state.internalNotes?.[customer.id] ?? customer.notes : '';

  if (!order || !sourceOrder || !customer || !route) {
    return (
      <section className="rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-lg font-black">הזמנה לא נמצאה</h2>
        <Link href="/admin" className="mt-3 inline-flex rounded-full bg-black px-4 py-2 text-sm font-black text-white">
          חזרה לדשבורד
        </Link>
      </section>
    );
  }

  const items = sourceOrder.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return {
      ...item,
      product,
      lineTotal: product ? product.price * item.qty : 0,
    };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1.45fr_.85fr]">
      <section className="rounded-2xl border border-black/10 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-3 py-3">
          <div>
            <p className="text-xs font-black text-black/45">הזמנה {order.id}</p>
            <h2 className="text-xl font-black">{order.customerName}</h2>
          </div>
          <CrmStatusBadge status={order.status} />
        </div>

        <div className="divide-y divide-black/10">
          {items.map((item) => (
            <div key={item.productId} className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_5rem_6rem_6rem] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{item.product?.name ?? item.productId}</p>
                <p className="truncate text-xs font-bold text-black/45">{item.product?.sku} · {item.product?.caseSize}</p>
              </div>
              <p className="text-sm font-black tabular-nums">{item.qty}</p>
              <p className="text-sm font-bold text-black/55">{item.product ? money(item.product.price) : '-'}</p>
              <p className="text-sm font-black tabular-nums">{money(item.lineTotal)}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-black/10 bg-[#e6e1d8] px-3 py-3">
          <span className="text-sm font-black">סה"כ להזמנה</span>
          <span className="text-2xl font-black tabular-nums">{money(order.total)}</span>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <h3 className="text-base font-black">פעולות</h3>
          <div className="mt-3 grid gap-2">
            <ActionButton
              icon={<Check size={16} />}
              label="אשר הזמנה"
              disabled={order.status === 'approved' || order.status === 'packed' || order.status === 'completed'}
              onClick={() => updateState(setOrderStatus(state, order.id, 'approved'))}
            />
            <ActionButton
              icon={<PackageCheck size={16} />}
              label="סמן נארז"
              disabled={order.status !== 'approved'}
              onClick={() => updateState(setOrderStatus(state, order.id, 'packed'))}
            />
            <ActionButton
              icon={<Truck size={16} />}
              label="סמן חולק"
              disabled={order.status !== 'packed'}
              onClick={() => updateState(setOrderStatus(state, order.id, 'completed'))}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <h3 className="text-base font-black">לקוח ומשלוח</h3>
          <dl className="mt-3 grid gap-2 text-sm">
            <InfoRow label="איש קשר" value={`${customer.contact} · ${customer.phone}`} />
            <InfoRow label="כתובת" value={customer.address} />
            <InfoRow label="קו" value={`${route.name} · ${route.driver}`} />
            <InfoRow label="דדליין" value={route.deadline} />
          </dl>
          <Link href={`/admin/customers/${customer.id}`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#e6e1d8] px-4 py-2 text-xs font-black hover:bg-black hover:text-white">
            <ClipboardList size={15} />
            פרופיל לקוח
          </Link>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <label className="text-base font-black" htmlFor="internal-note">הערת צוות</label>
          <textarea
            id="internal-note"
            value={note}
            onChange={(event) => updateState(setInternalNote(state, customer.id, event.target.value))}
            className="mt-2 min-h-28 w-full rounded-xl border border-black/10 bg-white p-3 text-sm font-bold leading-6 outline-none focus:ring-2 focus:ring-black/20"
          />
        </section>
      </aside>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white disabled:bg-black/10 disabled:text-black/35"
    >
      {icon}
      {label}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-2">
      <dt className="font-black text-black/45">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
