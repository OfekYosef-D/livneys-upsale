import Link from 'next/link';
import type { getAdminRouteDetail } from '@/features/admin/queries';
import { OrderStatusPill } from './OrderStatusPill';

type RouteData = NonNullable<Awaited<ReturnType<typeof getAdminRouteDetail>>>;

export function AdminRouteDetail({ route }: { route: RouteData }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-black/10 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-3">
          <Metric label="חלוקה קרובה" value={new Intl.DateTimeFormat('he-IL').format(new Date(route.nextDeliveryAt))} />
          <Metric label="דדליין" value={new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(route.nextCutoffAt))} />
          <Metric label="נהג" value={route.driver ?? 'לא הוגדר'} />
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white">
        <div className="border-b border-black/10 px-3 py-2">
          <h2 className="text-base font-black">לקוחות בקו {route.name}</h2>
        </div>
        <div className="divide-y divide-black/10">
          {route.customers.map((customer) => (
            <div key={customer.id} className="grid gap-2 px-3 py-3 md:grid-cols-[1fr_8rem_7rem] md:items-center">
              <div>
                <Link href={`/admin/customers/${customer.id}`} className="text-sm font-black hover:underline">
                  {customer.name}
                </Link>
                <p className="text-xs font-bold text-black/50">{customer.contact} · {customer.phone}</p>
              </div>
              {customer.latestOrder ? <OrderStatusPill status={customer.latestOrder.status} /> : <span className="text-xs font-black text-black/45">אין הזמנה</span>}
              {customer.latestOrder ? (
                <Link href={`/admin/orders/${customer.latestOrder.id}`} className="text-xs font-black underline">
                  צפייה בהזמנה
                </Link>
              ) : (
                <span />
              )}
            </div>
          ))}
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
