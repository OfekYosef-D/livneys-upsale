import Link from 'next/link';
import type React from 'react';
import { ArrowLeft, Bell, PackageCheck, Route, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { OrderStatusPill } from '@/features/admin/components/OrderStatusPill';
import type { getAdminDashboardData } from '@/features/admin/queries';
import { money } from '@/lib/format';

type DashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;

export function AdminDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.75fr)]">
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <Metric label="הזמנות פתוחות" value={data.kpis.openOrders.toString()} icon={<ShoppingBag size={18} />} strong />
          <Metric label="לאישור" value={data.kpis.needsApproval.toString()} icon={<PackageCheck size={18} />} />
          <Metric label="מוכנים לקו" value={data.kpis.readyForRoute.toString()} icon={<Route size={18} />} />
          <Metric label="חסרים" value={data.kpis.missingOrders.toString()} icon={<Bell size={18} />} />
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          <QuickAction href="/admin/manual-order" label="פתיחת הזמנה ידנית" detail="לשיחת טלפון או WhatsApp" icon={<ShoppingBag size={17} />} />
          <QuickAction href="/admin/customers" label="איתור לקוח" detail="חיפוש לפי קו, איש קשר או סטטוס" icon={<Users size={17} />} />
          <QuickAction href="/admin/products" label="בדיקת קטלוג" detail="סינון מוצרים, מחיר ומלאי" icon={<PackageCheck size={17} />} />
        </section>

        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
            <h2 className="text-base font-black">תור הזמנות</h2>
            <span className="text-xs font-black text-black/45">{data.orders.length} פתוחות</span>
          </div>
          <div className="divide-y divide-black/10">
            {data.orders.length === 0 ? (
              <p className="p-4 text-sm font-bold text-black/45">אין הזמנות פתוחות כרגע.</p>
            ) : (
              data.orders.map((order) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`} className="grid gap-3 px-4 py-4 hover:bg-[#e6e1d8] lg:grid-cols-[minmax(0,1fr)_7rem_6rem_6rem] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{order.customerName}</p>
                    <p className="truncate text-xs font-bold text-black/50">קו {order.routeName} · {new Intl.DateTimeFormat('he-IL').format(new Date(order.deliveryWindowStart))} · {order.source === 'ADMIN' ? 'ידני' : 'לקוח'}</p>
                  </div>
                  <OrderStatusPill status={order.status} />
                  <p className="text-sm font-black tabular-nums">{money(order.total)}</p>
                  <p className="text-xs font-black text-black/45">{order.hasUpsell ? 'כולל אפסייל' : `${order.lineCount} שורות`}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
          <h2 className="text-base font-black">מוכנות קווים</h2>
          <div className="mt-3 space-y-2">
            {data.routes.map((route) => (
              <Link key={route.id} href={`/admin/routes/${route.id}`} className="block rounded-xl bg-[#e6e1d8] p-3 hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25">
                <div className="flex items-center justify-between gap-3 text-sm font-black">
                  <span>קו {route.name}</span>
                  <span>{route.orderedCount}/{route.customerCount}</span>
                </div>
                <p className="mt-1 text-xs font-bold opacity-70">{route.missingCount} לקוחות ללא הזמנה</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} />
            <h2 className="text-base font-black">תזכורות דמו</h2>
          </div>
          <div className="mt-3 space-y-2">
            {data.reminderJobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-black/10 p-3">
                <p className="text-sm font-black">{job.customerName}</p>
                <p className="text-xs font-bold text-black/50">{job.channel} · {job.status} · קו {job.routeName}</p>
                {job.errorMessage && <p className="mt-1 text-xs font-bold text-red-700">{job.errorMessage}</p>}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Metric({ label, value, icon, strong = false }: { label: string; value: string; icon: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`rounded-2xl border border-black/10 p-4 shadow-[0_14px_42px_rgba(0,0,0,0.04)] ${strong ? 'bg-black text-white' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black opacity-60">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function QuickAction({ href, label, detail, icon }: { href: string; label: string; detail: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_14px_42px_rgba(0,0,0,0.04)] hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25">
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e6e1d8] text-black group-hover:bg-white">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black">{label}</span>
          <span className="block truncate text-xs font-bold opacity-60">{detail}</span>
        </span>
      </span>
      <ArrowLeft className="shrink-0" size={16} />
    </Link>
  );
}
