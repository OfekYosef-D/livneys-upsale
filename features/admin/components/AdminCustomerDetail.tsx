import Link from 'next/link';
import type { getAdminCustomerDetail } from '@/features/admin/queries';
import { money } from '@/lib/format';
import { OrderStatusPill } from './OrderStatusPill';

type CustomerData = NonNullable<Awaited<ReturnType<typeof getAdminCustomerDetail>>>;

export function AdminCustomerDetail({ customer }: { customer: CustomerData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,.8fr)_minmax(0,1.2fr)]">
      <aside className="space-y-4">
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
          <h2 className="text-xl font-black">{customer.name}</h2>
          <Info label="איש קשר" value={customer.contact} />
          <Info label="טלפון" value={customer.phone} href={`tel:${customer.phone}`} />
          <Info label="אזור" value={customer.region} />
          <Info label="קו" value={customer.routeName} href={`/admin/routes/${customer.routeId}`} />
          <Info label="כתובת" value={customer.address} />
          {customer.notes && <p className="mt-3 rounded-xl bg-[#e6e1d8] p-3 text-sm font-bold">{customer.notes}</p>}
          <Link href="/admin/manual-order" className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-black px-4 text-sm font-black text-white hover:bg-black/90">
            פתיחת הזמנה ידנית
          </Link>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
          <h2 className="text-base font-black">המלצות אפסייל</h2>
          <div className="mt-2 space-y-2">
            {customer.recommendations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-black/15 p-3 text-sm font-bold text-black/45">אין המלצות פעילות ללקוח הזה.</p>
            ) : (
              customer.recommendations.map((recommendation) => (
                <div key={recommendation.productName} className="rounded-xl bg-[#e6e1d8] p-3">
                  <p className="text-sm font-black">{recommendation.productName}</p>
                  <p className="text-xs font-bold text-black/55">{recommendation.reason || 'ללא נימוק'}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </aside>

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <div className="border-b border-black/10 px-3 py-2">
          <h2 className="text-base font-black">הזמנות</h2>
        </div>
        <div className="divide-y divide-black/10">
          {customer.orders.length === 0 ? (
            <p className="p-4 text-sm font-bold text-black/45">אין עדיין הזמנות שמורות ללקוח.</p>
          ) : (
            customer.orders.map((order) => (
              <Link key={order.id} href={`/admin/orders/${order.id}`} className="grid gap-2 px-4 py-4 hover:bg-[#e6e1d8] sm:grid-cols-[minmax(0,1fr)_8rem_7rem] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{order.id}</p>
                  <p className="text-xs font-bold text-black/45">{new Intl.DateTimeFormat('he-IL').format(new Date(order.deliveryWindowStart))}</p>
                </div>
                <OrderStatusPill status={order.status} />
                <p className="text-sm font-black tabular-nums">{money(order.total)}</p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = <p className="text-sm font-bold">{value}</p>;

  return (
    <div className="mt-3">
      <p className="text-xs font-black text-black/45">{label}</p>
      {href ? <Link href={href} className="hover:underline">{content}</Link> : content}
    </div>
  );
}
