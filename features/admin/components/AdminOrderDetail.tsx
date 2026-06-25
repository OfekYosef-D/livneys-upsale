import Link from 'next/link';
import type { getAdminOrderDetail } from '@/features/admin/queries';
import { money } from '@/lib/format';
import { OrderStatusPill } from './OrderStatusPill';

type OrderData = NonNullable<Awaited<ReturnType<typeof getAdminOrderDetail>>>;

export function AdminOrderDetail({ order }: { order: OrderData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <section className="rounded-2xl border border-black/10 bg-white">
        <div className="grid gap-2 border-b border-black/10 bg-[#e6e1d8] px-3 py-2 text-xs font-black text-black/55 md:grid-cols-[1fr_6rem_6rem_7rem]">
          <span>מוצר</span>
          <span>כמות</span>
          <span>מחיר</span>
          <span>סה״כ</span>
        </div>
        <div className="divide-y divide-black/10">
          {order.lines.map((line) => (
            <div key={line.id} className="grid gap-2 px-3 py-3 text-sm md:grid-cols-[1fr_6rem_6rem_7rem] md:items-center">
              <p className="font-black">{line.productName}</p>
              <p className="font-bold tabular-nums">{line.quantity}</p>
              <p className="font-bold tabular-nums">{money(line.unitPrice)}</p>
              <p className="font-black tabular-nums">{money(line.lineTotal)}</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-black/10 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-black/45">הזמנה</p>
              <h2 className="text-xl font-black">{order.id}</h2>
            </div>
            <OrderStatusPill status={order.status} />
          </div>
          <Info label="לקוח" value={order.customerName} href={`/admin/customers/${order.customerId}`} />
          <Info label="קו" value={order.routeName} href={order.routeId ? `/admin/routes/${order.routeId}` : undefined} />
          <Info label="איש קשר" value={`${order.customerContact} · ${order.customerPhone}`} />
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#e6e1d8] px-3 py-2">
            <span className="text-sm font-black">סה״כ</span>
            <span className="text-xl font-black tabular-nums">{money(order.total)}</span>
          </div>
          {order.notes && <p className="mt-3 rounded-xl border border-black/10 p-3 text-sm font-bold">{order.notes}</p>}
        </section>
      </aside>
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
