'use client';

import Link from 'next/link';
import type React from 'react';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  MessageCircle,
  PackageCheck,
  Phone,
  Route,
  Search,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { AdminOrderStatusActions } from '@/features/admin/components/AdminOrderStatusActions';
import { OrderStatusPill } from '@/features/admin/components/OrderStatusPill';
import type { getAdminDashboardData } from '@/features/admin/queries';
import { notificationJobStatusLabels, notificationTemplateLabels } from '@/features/notifications/ui-utils';
import { formatOrderNumber } from '@/features/orders/order-number';
import { paymentTermLabels } from '@/features/orders/payment-terms';
import type { OrderStatus } from '@/features/orders/utils';
import { money } from '@/lib/format';

type DashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;
type DashboardOrder = DashboardData['orders'][number];
type StatusFilter = 'all' | OrderStatus;

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'כל ההזמנות' },
  { value: 'SPECIAL_REQUEST', label: 'בקשות מיוחדות' },
  { value: 'SUBMITTED', label: 'מחכות לאישור' },
  { value: 'APPROVED', label: 'מאושרות' },
  { value: 'PACKED', label: 'ארוזות' },
];

function buildUrgentHeadline(needsApproval: number, missingOrders: number): string {
  if (needsApproval === 0 && missingOrders === 0) {
    return 'הכל מעודכן — אין טיפול דחוף';
  }

  if (needsApproval > 0 && missingOrders > 0) {
    return `${needsApproval} הזמנות לאישור · ${missingOrders} לקוחות חסרים`;
  }

  if (needsApproval > 0) {
    return `${needsApproval} הזמנות ממתינות לאישור`;
  }

  return `${missingOrders} לקוחות עדיין לא הזמינו`;
}

export function AdminDashboard({ data }: { data: DashboardData }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [routeId, setRouteId] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(data.orders[0]?.id ?? '');
  const readyCount = data.kpis.readyForRoute;
  const urgentHeadline = buildUrgentHeadline(data.kpis.needsApproval, data.kpis.missingOrders);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return data.orders.filter((order) => {
      const matchesStatus = status === 'all' || order.status === status;
      const matchesRoute = routeId === 'all' || order.routeId === routeId;
      const haystack = [
        order.id,
        String(order.orderNumber),
        order.customerName,
        order.customerContact,
        order.customerPhone,
        order.routeName,
        order.notes,
        order.internalNote,
        ...order.lines.map((line) => line.productName),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && matchesRoute && (normalizedSearch.length === 0 || haystack.includes(normalizedSearch));
    });
  }, [data.orders, routeId, search, status]);

  const selectedOrder =
    filteredOrders.find((order) => order.id === selectedOrderId)
    ?? filteredOrders[0]
    ?? data.orders.find((order) => order.id === selectedOrderId)
    ?? data.orders[0]
    ?? null;

  const issueOrders = data.orders.filter((order) => order.status === 'SPECIAL_REQUEST' || order.latestNotification?.status === 'FAILED');

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)] sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,.45fr)] xl:items-center">
          <div className="min-w-0">
            <p className="text-xs font-black text-black/45">מה צריך טיפול עכשיו</p>
            <h2 className="mt-1 text-2xl font-black leading-tight">
              {urgentHeadline}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-black/58">
              מתחילים מהזמנות שמחכות לאישור, בקשות מיוחדות ולקוחות שעדיין לא הזמינו. כל פעולה חשובה נשארת ליד המידע שצריך כדי לקבל החלטה.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <FocusMetric label="לאישור" value={data.kpis.needsApproval} detail="הזמנות שדורשות החלטה" icon={<PackageCheck size={18} />} tone={data.kpis.needsApproval > 0 ? 'amber' : 'neutral'} />
            <FocusMetric label="לקוחות ללא הזמנה" value={data.kpis.missingOrders} detail="לפי קווי חלוקה פעילים" icon={<Bell size={18} />} tone={data.kpis.missingOrders > 0 ? 'amber' : 'neutral'} />
            <FocusMetric label="מוכנות לקו" value={readyCount} detail="מאושרות או ארוזות" icon={<Route size={18} />} tone="green" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <QuickAction href="/admin/manual-order" label="פתח הזמנה ידנית" detail="לשיחה, WhatsApp או הזנה פנימית" icon={<ShoppingBag size={17} />} />
        <QuickAction href="/admin/customers" label="מצא לקוח" detail="שם עסק, איש קשר, טלפון או קו" icon={<Users size={17} />} />
        <QuickAction href="/admin/routes" label="בדוק קו חלוקה" detail="מי הזמין ומי עדיין חסר" icon={<Route size={17} />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(24rem,.95fr)]">
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
          <div className="border-b border-black/10 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-black">שולחן הזמנות</h2>
                <p className="mt-1 text-xs font-bold leading-5 text-black/50">בחרו הזמנה, בדקו את הפרטים, ואז העבירו אותה לשלב הבא.</p>
              </div>
              <span className="w-fit rounded-full bg-[#e6e1d8] px-3 py-1 text-xs font-black text-black/60">{filteredOrders.length}/{data.orders.length}</span>
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_10rem_11rem]">
              <label className="relative block">
                <span className="sr-only">חיפוש הזמנה</span>
                <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35" size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="חיפוש לפי לקוח, טלפון, קו, הערה או מוצר"
                  className="min-h-11 w-full rounded-xl border border-black/10 bg-[#f7f5f1] py-2 pl-3 pr-10 text-sm font-bold outline-none focus:border-black focus:ring-2 focus:ring-black/10"
                />
              </label>
              <label className="grid gap-1">
                <span className="sr-only">סינון סטטוס</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="min-h-11 rounded-xl border border-black/10 bg-[#f7f5f1] px-3 text-sm font-black outline-none focus:border-black focus:ring-2 focus:ring-black/10">
                  {statusFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="sr-only">סינון קו</span>
                <select value={routeId} onChange={(event) => setRouteId(event.target.value)} className="min-h-11 rounded-xl border border-black/10 bg-[#f7f5f1] px-3 text-sm font-black outline-none focus:border-black focus:ring-2 focus:ring-black/10">
                  <option value="all">כל הקווים</option>
                  {data.routes.map((route) => (
                    <option key={route.id} value={route.id}>קו {route.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="divide-y divide-black/10">
            {filteredOrders.length === 0 ? (
              <p className="p-5 text-sm font-bold text-black/45">אין הזמנות שמתאימות לסינון הנוכחי.</p>
            ) : (
              filteredOrders.map((order) => (
                <OrderQueueButton
                  key={order.id}
                  order={order}
                  selected={selectedOrder?.id === order.id}
                  onSelect={() => setSelectedOrderId(order.id)}
                />
              ))
            )}
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
          {selectedOrder ? <OrderReviewPanel order={selectedOrder} /> : <EmptyReviewPanel />}
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,.75fr)]">
        <RouteMissingPanel routes={data.routes} />
        <AttentionPanel orders={issueOrders} />
      </section>
    </div>
  );
}

function OrderQueueButton({ order, selected, onSelect }: { order: DashboardOrder; selected: boolean; onSelect: () => void }) {
  const hasMessageFailure = order.latestNotification?.status === 'FAILED';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full gap-3 px-4 py-4 text-right transition hover:bg-[#f7f5f1] sm:px-5 lg:grid-cols-[minmax(0,1fr)_7rem_6rem] lg:items-center ${
        selected ? 'bg-[#f7f5f1] ring-1 ring-inset ring-black/10' : 'bg-white'
      }`}
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-black">{order.customerName}</span>
          {order.status === 'SPECIAL_REQUEST' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-900">בקשה מיוחדת</span>}
          {hasMessageFailure && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-800">הודעה נכשלה</span>}
        </span>
        <span className="mt-1 block break-words text-xs font-bold leading-5 text-black/50">
          {formatOrderNumber(order.orderNumber)} / קו {order.routeName} / {formatDate(order.deliveryWindowStart)} / {order.source === 'ADMIN' ? 'הזמנה ידנית' : 'פורטל לקוח'}
        </span>
      </span>
      <OrderStatusPill status={order.status} />
      <span className="text-sm font-black tabular-nums">{money(order.total)}</span>
    </button>
  );
}

function OrderReviewPanel({ order }: { order: DashboardOrder }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
      <div className="border-b border-black/10 bg-[#f7f5f1] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-black/45">בדיקת הזמנה</p>
            <h2 className="mt-1 break-words text-xl font-black">{order.customerName}</h2>
            <p className="mt-1 break-words text-xs font-bold leading-5 text-black/50">הזמנה {formatOrderNumber(order.orderNumber)}</p>
          </div>
          <OrderStatusPill status={order.status} />
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <InfoPill label="איש קשר" value={order.customerContact} />
          <InfoPill label="טלפון" value={order.customerPhone} href={`tel:${order.customerPhone}`} icon={<Phone size={14} />} />
          <InfoPill label="קו" value={order.routeName} href={order.routeId ? `/admin/routes/${order.routeId}` : undefined} />
          <InfoPill label="חלוקה" value={formatDate(order.deliveryWindowStart)} />
          <InfoPill label="תנאי תשלום" value={paymentTermLabels[order.paymentTerm]} />
        </div>

        <NotificationStatusCard order={order} />

        {(order.notes || order.internalNote) && (
          <div className="grid gap-2">
            {order.notes && <NoteBlock label="הערה ללקוח" value={order.notes} />}
            {order.internalNote && <NoteBlock label="הערה פנימית" value={order.internalNote} />}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-black/10">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_6rem] gap-2 bg-[#e6e1d8] px-3 py-2 text-xs font-black text-black/55">
            <span>מוצר</span>
            <span>כמות</span>
            <span>סה״כ</span>
          </div>
          <div className="max-h-72 divide-y divide-black/10 overflow-y-auto">
            {order.lines.map((line) => (
              <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_6rem] gap-2 px-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="break-words font-black">{line.productName}</p>
                  <p className="mt-1 text-xs font-bold text-black/45">
                    {line.listUnitPrice > line.unitPrice ? `${money(line.listUnitPrice)} ← ${money(line.unitPrice)}` : money(line.unitPrice)}
                    {line.discountTotal > 0 ? ` / הנחה ${money(line.discountTotal)}` : ''}
                  </p>
                  {line.promotionLabel && <p className="mt-1 w-fit rounded-full bg-black px-2 py-0.5 text-[11px] font-black text-white">{line.promotionLabel}</p>}
                </div>
                <p className="font-black tabular-nums">{line.quantity}</p>
                <p className="font-black tabular-nums">{money(line.lineTotal)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[#e6e1d8] px-3 py-2">
          <TotalRow label="סכום ביניים" value={money(order.subtotal)} />
          {order.discountTotal > 0 && <TotalRow label="מבצעים והנחות מוצר" value={`-${money(order.discountTotal)}`} strong />}
          {order.paymentDiscountTotal > 0 && (
            <TotalRow label={`הנחת תשלום מיידי (${order.paymentDiscountPercent}%)`} value={`-${money(order.paymentDiscountTotal)}`} strong />
          )}
          <div className="mt-2 flex items-center justify-between border-t border-black/10 pt-2">
            <span className="text-sm font-black">סה״כ לפני מע״מ</span>
            <span className="text-xl font-black tabular-nums">{money(order.total)}</span>
          </div>
        </div>

        <AdminOrderStatusActions orderId={order.id} status={order.status} />

        <div className="flex flex-wrap gap-2 border-t border-black/10 pt-3">
          <Link href={`/admin/orders/${order.id}`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-[#e6e1d8] px-4 text-sm font-black hover:bg-black hover:text-white sm:flex-none">
            פתח עמוד הזמנה
          </Link>
          <Link href={`/admin/customers/${order.customerId}`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-white px-4 text-sm font-black ring-1 ring-black/10 hover:bg-black hover:text-white sm:flex-none">
            פרופיל לקוח
          </Link>
        </div>
      </div>
    </section>
  );
}

function NotificationStatusCard({ order }: { order: DashboardOrder }) {
  const notification = order.latestNotification;
  const tone =
    notification?.status === 'FAILED'
      ? 'border-red-200 bg-red-50 text-red-900'
      : notification?.status === 'SENT'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-black/10 bg-[#f7f5f1] text-black/70';

  if (!notification) {
    return (
      <div className="rounded-xl border border-black/10 bg-[#f7f5f1] p-3">
        <div className="flex items-center gap-2 text-sm font-black">
          <MessageCircle size={16} />
          <span>אין הודעת WhatsApp אחרונה להזמנה</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black">
            <MessageCircle size={16} />
            <span>{notificationJobStatusLabels[notification.status] ?? notification.status}</span>
          </div>
          <p className="mt-1 text-xs font-bold opacity-70">
            {notificationTemplateLabels[notification.templateKey] ?? notification.templateKey} / {formatDateTime(notification.processedAt ?? notification.scheduledAt)}
          </p>
        </div>
        <Link href={`/admin/notifications?q=${encodeURIComponent(order.id)}`} className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-black ring-1 ring-black/10 hover:bg-black hover:text-white">
          בדוק הודעות
        </Link>
      </div>
      {notification.errorMessage && <p className="mt-2 break-words text-xs font-black">{notification.errorMessage}</p>}
    </div>
  );
}

function EmptyReviewPanel() {
  return (
    <section className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-center">
      <p className="text-base font-black">אין הזמנה לבדיקה</p>
      <p className="mt-1 text-sm font-bold text-black/45">שנו סינון או חיפוש כדי לראות הזמנות פעילות.</p>
    </section>
  );
}

function RouteMissingPanel({ routes }: { routes: DashboardData['routes'] }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-black">לקוחות חסרים לפי קו</h2>
          <p className="mt-1 text-xs font-bold leading-5 text-black/50">מי עדיין לא הזמין לפני החלוקה הקרובה.</p>
        </div>
        <Link href="/admin/routes" className="w-fit rounded-full bg-[#e6e1d8] px-3 py-1 text-xs font-black hover:bg-black hover:text-white">
          כל הקווים
        </Link>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {routes.map((route) => (
          <div key={route.id} className="rounded-xl border border-black/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/admin/routes/${route.id}`} className="text-sm font-black hover:underline">קו {route.name}</Link>
              <span className="text-xs font-black text-black/55">{route.orderedCount}/{route.customerCount}</span>
            </div>
            {route.missingCustomers.length === 0 ? (
              <p className="mt-2 text-xs font-bold text-emerald-700">כל הלקוחות הפעילים עם הזמנה.</p>
            ) : (
              <div className="mt-2 space-y-1">
                {route.missingCustomers.slice(0, 3).map((customer) => (
                  <p key={customer.id} className="break-words text-xs font-bold text-black/60">
                    {customer.name} / {customer.contact} / {customer.phone}
                  </p>
                ))}
                {route.missingCustomers.length > 3 && <p className="text-xs font-black text-black/45">ועוד {route.missingCustomers.length - 3} לקוחות</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AttentionPanel({ orders }: { orders: DashboardOrder[] }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-2">
        <AlertTriangle size={17} />
        <h2 className="text-base font-black">דורש תשומת לב</h2>
      </div>
      <div className="mt-3 space-y-2">
        {orders.length === 0 ? (
          <p className="rounded-xl bg-[#f7f5f1] p-3 text-sm font-bold text-black/45">אין בקשות מיוחדות או תקלות הודעה פתוחות.</p>
        ) : (
          orders.slice(0, 5).map((order) => (
            <Link key={order.id} href={`/admin/orders/${order.id}`} className="block rounded-xl border border-black/10 p-3 hover:bg-[#f7f5f1]">
              <p className="break-words text-sm font-black">{order.customerName}</p>
              <p className="mt-1 text-xs font-bold text-black/50">
                {order.status === 'SPECIAL_REQUEST' ? 'בקשה מיוחדת' : 'תקלה בהודעת WhatsApp'} / {money(order.total)}
              </p>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function FocusMetric({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: React.ReactNode; tone: 'neutral' | 'amber' | 'green' }) {
  const toneClass = {
    neutral: 'bg-[#f7f5f1] text-black',
    amber: 'bg-amber-50 text-amber-900',
    green: 'bg-emerald-50 text-emerald-900',
  }[tone];

  return (
    <div className={`rounded-xl border border-black/10 p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black opacity-70">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-70">{detail}</p>
    </div>
  );
}

function QuickAction({ href, label, detail, icon }: { href: string; label: string; detail: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_14px_42px_rgba(0,0,0,0.04)] hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e6e1d8] text-black group-hover:bg-white">{icon}</span>
        <span className="min-w-0">
          <span className="block break-words text-sm font-black">{label}</span>
          <span className="block break-words text-xs font-bold opacity-60">{detail}</span>
        </span>
      </span>
      <ArrowLeft className="shrink-0" size={16} />
    </Link>
  );
}

function InfoPill({ label, value, href, icon }: { label: string; value: string; href?: string; icon?: React.ReactNode }) {
  const content = (
    <span className="flex min-w-0 items-center gap-1">
      {icon}
      <span className="break-words text-sm font-black">{value}</span>
    </span>
  );

  return (
    <div className="rounded-xl border border-black/10 p-3">
      <p className="text-xs font-black text-black/45">{label}</p>
      {href ? <Link href={href} className="mt-1 block hover:underline">{content}</Link> : <p className="mt-1">{content}</p>}
    </div>
  );
}

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 p-3">
      <p className="text-xs font-black text-black/45">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold leading-6">{value}</p>
    </div>
  );
}

function TotalRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 text-sm ${strong ? 'font-black text-emerald-800' : 'font-bold'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}
