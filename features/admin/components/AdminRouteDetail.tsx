import Link from 'next/link';
import type { getAdminRouteDetail } from '@/features/admin/queries';
import { OrderStatusPill } from './OrderStatusPill';

type RouteData = NonNullable<Awaited<ReturnType<typeof getAdminRouteDetail>>>;

export function AdminRouteDetail({ route }: { route: RouteData }) {
  const missingCount = route.customers.filter((customer) => !customer.latestOrder).length;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <div className="grid gap-2 md:grid-cols-5">
          <Metric label="חלוקה קרובה" value={new Intl.DateTimeFormat('he-IL').format(new Date(route.nextDeliveryAt))} />
          <Metric label="דדליין" value={new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(route.nextCutoffAt))} />
          <Metric label="נהג" value={route.driver ?? 'לא הוגדר'} />
          <Metric label="לקוחות" value={String(route.customers.length)} />
          <Metric label="חסרים" value={String(missingCount)} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <div className="border-b border-black/10 px-4 py-3">
          <h2 className="text-base font-black">לקוחות בקו {route.name}</h2>
          <p className="mt-1 text-xs font-bold text-black/45">{missingCount === 0 ? 'כל הלקוחות הפעילים בקו עם הזמנה פתוחה.' : `${missingCount} לקוחות עדיין ללא הזמנה פתוחה.`}</p>
        </div>
        <div className="divide-y divide-black/10">
          {route.customers.length === 0 ? (
            <p className="p-4 text-sm font-bold text-black/45">אין לקוחות פעילים בקו הזה.</p>
          ) : (
            route.customers.map((customer) => (
              <div key={customer.id} className="grid gap-2 px-4 py-4 hover:bg-[#f7f5f1] md:grid-cols-[minmax(0,1fr)_8rem_7rem] md:items-center">
                <div className="min-w-0">
                  <Link href={`/admin/customers/${customer.id}`} className="truncate text-sm font-black hover:underline">
                    {customer.name}
                  </Link>
                  <p className="truncate text-xs font-bold text-black/50">{customer.contact} · {customer.phone}</p>
                </div>
                {customer.latestOrder ? <OrderStatusPill status={customer.latestOrder.status} /> : <span className="w-fit rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-800">אין הזמנה</span>}
                {customer.latestOrder ? (
                  <Link href={`/admin/orders/${customer.latestOrder.id}`} className="text-xs font-black underline">
                    צפייה בהזמנה
                  </Link>
                ) : (
                  <Link href="/admin/manual-order" className="text-xs font-black underline">
                    הזמנה ידנית
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#e6e1d8] p-3">
      <p className="text-xs font-black text-black/50">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}
