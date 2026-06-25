import Link from 'next/link';
import type React from 'react';
import { Bell, PackageCheck, Route, ShoppingBag, TrendingUp } from 'lucide-react';
import { OrderStatusPill } from '@/features/admin/components/OrderStatusPill';
import type { getAdminDashboardData } from '@/features/admin/queries';
import { money } from '@/lib/format';

type DashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;

export function AdminDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_.75fr]">
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="הזמנות פתוחות" value={data.kpis.openOrders.toString()} icon={<ShoppingBag size={18} />} strong />
          <Metric label="לאישור" value={data.kpis.needsApproval.toString()} icon={<PackageCheck size={18} />} />
          <Metric label="מוכנים לקו" value={data.kpis.readyForRoute.toString()} icon={<Route size={18} />} />
          <Metric label="חסרים" value={data.kpis.missingOrders.toString()} icon={<Bell size={18} />} />
        </div>

        <div className="rounded-2xl border border-black/10 bg-white">
          <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
            <h2 className="text-base font-black">תור הזמנות</h2>
            <span className="text-xs font-black text-black/45">{data.orders.length} פתוחות</span>
          </div>
          <div className="divide-y divide-black/10">
            {data.orders.length === 0 ? (
              <p className="p-4 text-sm font-bold text-black/45">אין הזמנות פתוחות כרגע.</p>
            ) : (
              data.orders.map((order) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`} className="grid gap-2 px-3 py-3 hover:bg-[#e6e1d8] md:grid-cols-[1fr_7rem_6rem_6rem] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{order.customerName}</p>
                    <p className="truncate text-xs font-bold text-black/50">קו {order.routeName} · {new Intl.DateTimeFormat('he-IL').format(new Date(order.deliveryWindowStart))}</p>
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
        <section className="rounded-2xl border border-black/10 bg-white p-3">
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

        <section className="rounded-2xl border border-black/10 bg-white p-3">
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
    <div className={`rounded-2xl border border-black/10 p-3 ${strong ? 'bg-black text-white' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black opacity-60">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}
