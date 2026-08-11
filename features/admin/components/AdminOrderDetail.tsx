import Link from 'next/link';
import type { getAdminOrderDetail } from '@/features/admin/queries';
import { OrderFinancialSummary } from '@/features/orders/components/OrderFinancialSummary';
import { formatOrderNumber } from '@/features/orders/order-number';
import { paymentTermLabels } from '@/features/orders/payment-terms';
import { money } from '@/lib/format';
import { AdminOrderStatusActions } from './AdminOrderStatusActions';
import { OrderStatusPill } from './OrderStatusPill';
import { AdminAdditionRequests } from '@/features/order-additions/components/AdminAdditionRequests';

type OrderData = NonNullable<Awaited<ReturnType<typeof getAdminOrderDetail>>>;

export function AdminOrderDetail({ order }: { order: OrderData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <div className="hidden gap-2 border-b border-black/10 bg-[#e6e1d8] px-4 py-2 text-xs font-black text-black/55 md:grid md:grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_7rem]">
          <span>מוצר</span>
          <span>כמות</span>
          <span>מחיר</span>
          <span>הנחה</span>
          <span>סה״כ</span>
        </div>
        <div className="divide-y divide-black/10">
          {order.lines.map((line) => (
            <div key={line.id} className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_7rem] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-black">{line.productName}</p>
                {line.promotionLabel && <p className="mt-1 w-fit rounded-full bg-black px-2 py-0.5 text-[11px] font-black text-white">{line.promotionLabel}</p>}
              </div>
              <p className="font-bold tabular-nums"><span className="md:hidden">כמות: </span>{line.quantity}</p>
              <div className="font-bold tabular-nums">
                <span className="md:hidden">מחיר: </span>
                {line.listUnitPrice > line.unitPrice && <p className="text-xs text-black/40 line-through">{money(line.listUnitPrice)}</p>}
                <p>{money(line.unitPrice)}</p>
              </div>
              <p className={`font-black tabular-nums ${line.discountTotal > 0 ? 'text-emerald-700' : 'text-black/35'}`}>
                <span className="md:hidden">הנחה: </span>{line.discountTotal > 0 ? `-${money(line.discountTotal)}` : money(0)}
              </p>
              <p className="font-black tabular-nums"><span className="md:hidden">סה״כ: </span>{money(line.lineTotal)}</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-black/45">הזמנה</p>
              <h2 className="text-xl font-black">{formatOrderNumber(order.orderNumber)}</h2>
            </div>
            <OrderStatusPill status={order.status} />
          </div>
          <Info label="לקוח" value={order.customerName} href={`/admin/customers/${order.customerId}`} />
          <Info label="קו" value={order.routeName} href={order.routeId ? `/admin/routes/${order.routeId}` : undefined} />
          <Info label="מקור" value={order.source === 'ADMIN' ? 'הזמנה ידנית' : 'פורטל לקוח'} />
          <Info label="תנאי תשלום" value={paymentTermLabels[order.paymentTerm]} />
          <Info label="איש קשר" value={`${order.customerContact} · ${order.customerPhone}`} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniMetric label="שורות" value={String(order.lineCount)} />
            <MiniMetric label="חלוקה" value={new Intl.DateTimeFormat('he-IL').format(new Date(order.deliveryWindowStart))} />
          </div>
          <div className="mt-4 rounded-xl bg-[#e6e1d8] px-3 pb-3 pt-0.5">
            <OrderFinancialSummary
              subtotal={order.subtotal}
              productDiscountTotal={order.discountTotal}
              paymentDiscountPercent={order.paymentDiscountPercent}
              paymentDiscountTotal={order.paymentDiscountTotal}
              totalBeforeVat={order.total}
              vatRatePercent={order.vatRatePercent}
              vatTotal={order.vatTotal}
              totalIncludingVat={order.totalIncludingVat}
            />
          </div>
          <div className="mt-3 rounded-xl border border-black/10 p-3 text-xs font-bold leading-5">
            <p className="font-black">תיעוד אישור מסחרי</p>
            {order.commercialTermsAcceptedAt ? (
              <p className="mt-1 text-black/60">
                הלקוח אישר הצהרת B2B ב־{new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(order.commercialTermsAcceptedAt))}
                {order.commercialTermsVersion ? ` · גרסה ${order.commercialTermsVersion}` : ''}.
              </p>
            ) : (
              <p className="mt-1 text-black/60">
                {order.source === 'ADMIN' ? 'הזמנה ידנית שהוזנה על ידי הצוות; לא נדרש אישור פורטל לקוח.' : 'לא נשמר אישור הצהרה להזמנה היסטורית זו.'}
              </p>
            )}
          </div>
          {order.notes && <p className="mt-3 rounded-xl border border-black/10 p-3 text-sm font-bold">{order.notes}</p>}
          {order.internalNote && <p className="mt-3 rounded-xl bg-[#e6e1d8] p-3 text-xs font-black text-black/65">{order.internalNote}</p>}
          {['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED'].includes(order.status) && !order.additionRequests.some((request) => request.status === 'PENDING') && (
            <Link href={`/admin/orders/${order.id}/addition`} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-[#e6e1d8] px-4 text-sm font-black text-black ring-1 ring-black/10 hover:bg-black hover:text-white">
              רישום תוספת מאושרת
            </Link>
          )}
          <AdminOrderStatusActions orderId={order.id} status={order.status} />
        </section>
      </aside>
      <div className="lg:col-span-2">
        <AdminAdditionRequests orderId={order.id} requests={order.additionRequests} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/10 p-3">
      <p className="text-xs font-black text-black/45">{label}</p>
      <p className="mt-1 text-sm font-black tabular-nums">{value}</p>
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
