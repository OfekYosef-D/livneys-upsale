import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { DefinitionItem, DefinitionList } from '@/components/ui/Toolbar';
import { formatDateTime, formatLongDate } from '@/lib/datetime';
import { paths } from '@/lib/paths';
import { legalDocuments } from '../../legal/documents';
import { AdminAdditionRequests } from '../../order-additions/components/AdminAdditionRequests';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { OrderLinesTable } from '../../orders/components/OrderLinesTable';
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge';
import { canAddItems } from '../../orders/status';
import { paymentTermLabels } from '../../orders/totals';
import { AdminPaymentReceipts } from '../../payments/components/AdminPaymentReceipts';
import type { AdminOrderDetailData } from '../queries';
import { AdminOrderStatusActions } from './AdminOrderStatusActions';

const documentTitles = Object.fromEntries(legalDocuments.map((document) => [document.type, document.title]));

export function AdminOrderDetail({ order }: { order: AdminOrderDetailData }) {
  const hasPendingAddition = order.additionRequests.some((request) => request.status === 'PENDING');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        <Panel>
          <PanelHeader title="פריטים" description={`${order.lines.length} שורות`} />
          <OrderLinesTable lines={order.lines} />
        </Panel>
        <AdminAdditionRequests requests={order.additionRequests} />
        <AdminPaymentReceipts orderId={order.id} total={order.totalIncludingVat} summary={order.paymentSummary} receipts={order.paymentReceipts} />
      </div>

      {/* On phones the status actions come first: approving is the most common task. */}
      <aside className="order-first space-y-4 lg:order-none">
        <Panel className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="text-xs text-black/55">{order.source === 'ADMIN' ? 'הזמנה ידנית' : 'הוזמן בפורטל'}</span>
          </div>
          <DefinitionList>
            <DefinitionItem label="לקוח"><Link href={paths.admin.customer(order.customerId)} className="underline-offset-2 hover:underline">{order.customerName}</Link></DefinitionItem>
            <DefinitionItem label="איש קשר">
              {order.customerContact} · <a href={`tel:${order.customerPhone}`} className="hover:underline" dir="ltr">{order.customerPhone}</a>
            </DefinitionItem>
            <DefinitionItem label="קו">{order.routeId ? <Link href={paths.admin.route(order.routeId)} className="hover:underline">{order.routeName}</Link> : order.routeName}</DefinitionItem>
            <DefinitionItem label="חלוקה">{formatLongDate(order.deliveryWindowStart)}</DefinitionItem>
            <DefinitionItem label="תנאי תשלום">{paymentTermLabels[order.paymentTerm]}</DefinitionItem>
            {order.submittedAt && <DefinitionItem label="נשלחה">{formatDateTime(order.submittedAt)}</DefinitionItem>}
          </DefinitionList>
          {order.notes && <p className="rounded-md bg-[var(--pantry-soft)] p-2.5 text-sm"><span className="font-semibold">הערת לקוח: </span>{order.notes}</p>}
          {order.internalNote && <p className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-950">{order.internalNote}</p>}
          <OrderFinancialSummary totals={order} />
          <AdminOrderStatusActions orderId={order.id} status={order.status} />
          {canAddItems(order.status) && !hasPendingAddition && (
            <Button href={paths.admin.orderAddition(order.id)} variant="secondary" fullWidth>הוספת פריטים (לבקשת הלקוח)</Button>
          )}
        </Panel>

        <Panel className="p-4 text-xs leading-5 text-black/60">
          <p className="font-semibold text-black">תיעוד אישור תנאים</p>
          {order.legalAcceptances.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {order.legalAcceptances.map((acceptance) => (
                <li key={acceptance.id}>
                  {documentTitles[acceptance.documentType] ?? acceptance.documentType} · גרסה {acceptance.documentVersion} · {formatDateTime(acceptance.acceptedAt)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">{order.source === 'ADMIN' ? 'הזמנה ידנית – לא נדרש אישור לקוח בפורטל.' : 'לא נשמר אישור להזמנה זו.'}</p>
          )}
        </Panel>
      </aside>
    </div>
  );
}
