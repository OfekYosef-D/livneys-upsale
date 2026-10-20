'use client';

import Link from 'next/link';
import { MessageCircle, Phone, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buttonClassName } from '@/components/ui/Button';
import { DataTable, Td, Th, Tr } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/Notice';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { DefinitionItem, DefinitionList, Kpi, KpiStrip, Toolbar } from '@/components/ui/Toolbar';
import { formatDate, formatShortDateTime, formatWeekdayDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { paths } from '@/lib/paths';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { OrderLinesTable } from '../../orders/components/OrderLinesTable';
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge';
import { formatOrderNumber, type OrderStatus } from '../../orders/status';
import type { AdminDashboardData, AdminOrderView } from '../queries';
import { AdminOrderStatusActions } from './AdminOrderStatusActions';

type StatusFilter = 'all' | OrderStatus;

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'כל ההזמנות הפתוחות' },
  { value: 'SUBMITTED', label: 'ממתינות לאישור' },
  { value: 'SPECIAL_REQUEST', label: 'בקשות מיוחדות' },
  { value: 'APPROVED', label: 'מאושרות' },
  { value: 'PACKED', label: 'ארוזות' },
];

export function AdminDashboard({ data, appOrigin }: { data: AdminDashboardData; appOrigin: string }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [routeId, setRouteId] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(data.orders[0]?.id ?? null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.orders.filter((order) =>
      (status === 'all' || order.status === status)
      && (routeId === 'all' || order.routeId === routeId)
      && (!needle || [String(order.orderNumber), order.customerName, order.customerContact, order.customerPhone, order.routeName, order.notes, ...order.lines.map((line) => line.productName)]
        .some((value) => value?.toLowerCase().includes(needle))));
  }, [data.orders, routeId, search, status]);
  const selected = filtered.find((order) => order.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="space-y-4">
      <Panel>
        <KpiStrip className="sm:grid-cols-4">
          <Kpi label="ממתינות לאישור" value={data.kpis.needsApproval} tone={data.kpis.needsApproval > 0 ? 'warning' : 'neutral'} />
          <Kpi label="מוכנות לחלוקה" value={data.kpis.readyForRoute} tone="success" />
          <Kpi label="לקוחות שטרם הזמינו" value={data.kpis.missingOrders} detail="לחלוקה הקרובה" tone={data.kpis.missingOrders > 0 ? 'warning' : 'neutral'} />
          <Kpi label="הודעות שנכשלו" value={data.kpis.failedNotifications} tone={data.kpis.failedNotifications > 0 ? 'danger' : 'neutral'} />
        </KpiStrip>
      </Panel>

      <div className={selected ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]' : ''}>
        <Panel>
          <Toolbar>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[12rem] flex-1">
                <span className="sr-only">חיפוש הזמנה</span>
                <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35" size={15} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי לקוח, מספר הזמנה, טלפון או מוצר" className="ui-field min-h-9 bg-[var(--pantry-soft)] pr-9" />
              </label>
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="סינון לפי סטטוס" className="ui-field min-h-9 w-auto bg-[var(--pantry-soft)]">
                {statusFilters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select value={routeId} onChange={(event) => setRouteId(event.target.value)} aria-label="סינון לפי קו" className="ui-field min-h-9 w-auto bg-[var(--pantry-soft)]">
                <option value="all">כל הקווים</option>
                {data.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
              </select>
              <span className="ms-auto text-[11px] tabular-nums text-black/45">{filtered.length}/{data.orders.length}</span>
            </div>
          </Toolbar>
          {filtered.length === 0 ? (
            <EmptyState title="אין הזמנות פתוחות" description={data.orders.length ? 'נסו לשנות את הסינון.' : 'הזמנות חדשות יופיעו כאן.'} />
          ) : (
            <DataTable minWidth="34rem">
              <thead>
                <tr>
                  <Th>לקוח</Th>
                  <Th>סטטוס</Th>
                  <Th>סכום</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <Tr key={order.id} selected={selected?.id === order.id} onClick={() => setSelectedId(order.id)}>
                    <Td>
                      <p className="font-medium">{order.customerName}</p>
                      <p className="text-xs text-black/50">{formatOrderNumber(order.orderNumber)} · {order.routeName} · חלוקה {formatDate(order.deliveryWindowStart)}</p>
                    </Td>
                    <Td><OrderStatusBadge status={order.status} /></Td>
                    <Td className="tabular-nums">{formatMoney(order.totalIncludingVat)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Panel>

        {selected && <OrderQuickView order={selected} />}
      </div>

      <MissingOrdersPanel routes={data.routes} appOrigin={appOrigin} />
    </div>
  );
}

function OrderQuickView({ order }: { order: AdminOrderView }) {
  return (
    <Panel className="h-fit xl:sticky xl:top-4">
      <PanelHeader
        title={`${order.customerName} · ${formatOrderNumber(order.orderNumber)}`}
        actions={<OrderStatusBadge status={order.status} />}
      />
      <div className="space-y-3 p-3">
        <DefinitionList>
          <DefinitionItem label="איש קשר">{order.customerContact}</DefinitionItem>
          <DefinitionItem label="טלפון"><a href={`tel:${order.customerPhone}`} className="hover:underline" dir="ltr">{order.customerPhone}</a></DefinitionItem>
        </DefinitionList>
        {order.notes && <p className="rounded-md bg-[var(--pantry-soft)] p-2 text-xs"><span className="font-semibold">הערת לקוח: </span>{order.notes}</p>}
        <OrderLinesTable lines={order.lines} />
        <OrderFinancialSummary totals={order} />
        <AdminOrderStatusActions key={order.id} orderId={order.id} status={order.status} />
        <Link href={paths.admin.order(order.id)} className={buttonClassName({ variant: 'outline', fullWidth: true })}>לעמוד ההזמנה המלא</Link>
      </div>
    </Panel>
  );
}

function MissingOrdersPanel({ routes, appOrigin }: { routes: AdminDashboardData['routes']; appOrigin: string }) {
  const withGaps = routes.filter((route) => route.missingCustomers.length > 0);
  if (withGaps.length === 0) return null;

  return (
    <Panel>
      <PanelHeader title="מי עוד לא הזמין לחלוקה הקרובה" description="תזכורת אישית בוואטסאפ נפתחת מהטלפון שלכם עם הודעה מוכנה." />
      <div className="divide-y divide-[var(--pantry-line)]">
        {withGaps.map((route) => (
          <section key={route.id} className="px-4 py-3">
            <p className="text-sm font-semibold">
              <Link href={paths.admin.route(route.id)} className="hover:underline">{route.name}</Link>
              <span className="ms-2 text-xs font-normal text-black/55">
                {route.orderedCount}/{route.customerCount} הזמינו · חלוקה ב{formatWeekdayDate(route.deliveryAt)} · נסגר {formatShortDateTime(route.cutoffAt)}
              </span>
            </p>
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {route.missingCustomers.map((customer) => {
                const reminder = `שלום ${customer.contact}, תזכורת מליבני'ס: ההזמנות לחלוקה ב${formatWeekdayDate(route.deliveryAt)} נסגרות ב-${formatShortDateTime(route.cutoffAt)}.\nלהזמנה מהירה: ${appOrigin}/login`;
                return (
                  <li key={customer.id} className="flex items-center justify-between gap-2 rounded-md bg-[var(--pantry-soft)] px-3 py-2">
                    <Link href={paths.admin.customer(customer.id)} className="min-w-0 truncate text-sm font-medium hover:underline">{customer.name}</Link>
                    <span className="flex shrink-0 gap-1">
                      <a href={`tel:${customer.phone}`} className={buttonClassName({ variant: 'outline', size: 'sm' })} aria-label={`התקשרות ל${customer.name}`}><Phone size={13} /></a>
                      <a href={buildWhatsAppUrl(customer.phone, reminder)} target="_blank" rel="noreferrer" className={buttonClassName({ variant: 'outline', size: 'sm' })}>
                        <MessageCircle size={13} /> תזכורת
                      </a>
                      <Link href={paths.admin.manualOrder(customer.id)} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>הזמנה ידנית</Link>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}
