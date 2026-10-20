import { ArrowLeft, CheckCircle2, Mail, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { formatDateTime, formatWeekdayDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { paths } from '@/lib/paths';
import { getAdditionRequestPresentation } from '../../order-additions/view-model';
import { COMMERCIAL_ORDER_NOTICE } from '../../orders/commercial-terms';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { OrderLinesTable } from '../../orders/components/OrderLinesTable';
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge';
import { formatOrderNumber } from '../../orders/status';
import { paymentTermLabels } from '../../orders/totals';
import type { OrderView } from '../../orders/view-model';
import type { AdditionRequestView, PortalCustomer } from '../types';
import { CustomerHeader } from './CustomerHeader';

/**
 * The customer's view of one order. Right after submitting (`justPlaced`) it doubles as the
 * confirmation screen.
 */
export function CustomerOrderView({
  customer,
  order,
  canAddItems,
  latestAddition,
  justPlaced = false,
}: {
  customer: PortalCustomer;
  order: OrderView;
  canAddItems: boolean;
  latestAddition: AdditionRequestView | null;
  justPlaced?: boolean;
}) {
  const presentation = latestAddition ? getAdditionRequestPresentation(latestAddition.status) : null;

  return (
    <main className="app-surface min-h-screen pb-12 text-black">
      <CustomerHeader title={customer.name} subtitle={`הזמנה ${formatOrderNumber(order.orderNumber)}`} />

      <div className="mx-auto mt-4 max-w-5xl space-y-4 px-3 md:px-6">
        {justPlaced && (
          <Notice tone="success" icon={<CheckCircle2 size={18} />} title={`תודה ${customer.contact}, ההזמנה התקבלה!`}>
            <span className="inline-flex items-center gap-1"><Mail size={12} aria-hidden="true" /> נשלח אליכם אישור במייל. הצוות יעדכן כשההזמנה תאושר.</span>
          </Notice>
        )}

        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-black/55">חלוקה ב{formatWeekdayDate(order.deliveryWindowStart)}</p>
            <h1 className="text-2xl font-semibold">הזמנה {formatOrderNumber(order.orderNumber)}</h1>
          </div>
          <OrderStatusBadge status={order.status} />
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="ui-panel">
            <OrderLinesTable lines={order.lines} />
          </section>

          <aside className="space-y-4">
            <section className="ui-panel p-4">
              <p className="text-xs text-black/55">תנאי תשלום: <span className="font-semibold text-black">{paymentTermLabels[order.paymentTerm]}</span></p>
              <OrderFinancialSummary totals={order} className="mt-3" />
              {order.notes && <p className="mt-3 rounded-md bg-[var(--pantry-soft)] p-2.5 text-xs">הערה: {order.notes}</p>}
            </section>

            <section className="ui-panel space-y-3 p-4">
              <div className="flex items-start gap-2">
                <Plus size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold">שכחתם משהו?</h2>
                  <p className="mt-1 text-xs leading-5 text-black/55">אפשר לבקש תוספת עד שההזמנה נארזת. התוספת מצטרפת להזמנה אחרי אישור הצוות.</p>
                </div>
              </div>
              {latestAddition && presentation && (
                <div className="rounded-md bg-[var(--pantry-soft)] p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">בקשת תוספת</span>
                    <Badge tone={presentation.tone}>{presentation.label}</Badge>
                  </div>
                  <p className="mt-1 text-black/60">{latestAddition.lines.length} מוצרים · {formatMoney(latestAddition.totalIncludingVat)} כולל מע״מ · {formatDateTime(latestAddition.submittedAt)}</p>
                  {latestAddition.rejectionReason && <p className="mt-1 text-red-800">סיבה: {latestAddition.rejectionReason}</p>}
                </div>
              )}
              {canAddItems ? (
                <Button href={paths.customer.orderAddition(customer.id, order.orderNumber)} fullWidth>
                  {presentation?.actionLabel ?? 'הוספת פריטים'} <ArrowLeft size={16} aria-hidden="true" />
                </Button>
              ) : (
                <p className="text-xs font-medium text-black/55">ההזמנה כבר נארזה ולא ניתן להוסיף לה פריטים.</p>
              )}
            </section>

            <p className="text-[11px] leading-5 text-black/50">{COMMERCIAL_ORDER_NOTICE}</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
