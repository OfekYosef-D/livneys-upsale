import Link from 'next/link';
import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Kpi, KpiStrip } from '@/components/ui/Toolbar';
import { formatShortDateTime, formatWeekdayDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { paths } from '@/lib/paths';
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge';
import { formatOrderNumber } from '../../orders/status';
import type { AdminRouteDetailData } from '../queries';

export function AdminRouteDetail({ route }: { route: AdminRouteDetailData }) {
  const missing = route.customers.filter((customer) => !customer.order).length;

  return (
    <div className="space-y-4">
      <Panel>
        <KpiStrip className="sm:grid-cols-4">
          <Kpi label="חלוקה קרובה" value={formatWeekdayDate(route.deliveryAt)} />
          <Kpi label="סגירת הזמנות" value={formatShortDateTime(route.cutoffAt)} />
          <Kpi label="הזמינו" value={`${route.customers.length - missing}/${route.customers.length}`} tone="success" />
          <Kpi label="טרם הזמינו" value={missing} tone={missing > 0 ? 'warning' : 'neutral'} />
        </KpiStrip>
      </Panel>

      <Panel>
        <PanelHeader title={`לקוחות בקו ${route.name}`} description={route.driver ? `נהג: ${route.driver}` : undefined} />
        {route.customers.length === 0 ? (
          <p className="p-4 text-sm text-black/60">אין לקוחות פעילים בקו הזה.</p>
        ) : (
          <DataTable minWidth="34rem">
            <thead>
              <tr>
                <Th>לקוח</Th>
                <Th>הזמנה לחלוקה הקרובה</Th>
                <Th>פעולה</Th>
              </tr>
            </thead>
            <tbody>
              {route.customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-[var(--pantry-soft)]">
                  <Td>
                    <Link href={paths.admin.customer(customer.id)} className="font-medium hover:underline">{customer.name}</Link>
                    <p className="text-xs text-black/60">{customer.contact} · <span dir="ltr">{customer.phone}</span></p>
                  </Td>
                  <Td label="הזמנה לחלוקה הקרובה">
                    {customer.order ? (
                      <span className="flex items-center gap-2">
                        <OrderStatusBadge status={customer.order.status} />
                        <span className="text-xs tabular-nums text-black/60">{formatMoney(customer.order.totalIncludingVat)}</span>
                      </span>
                    ) : (
                      <Badge tone="warning">טרם הזמין</Badge>
                    )}
                  </Td>
                  <Td actions>
                    {customer.order ? (
                      <Link href={paths.admin.order(customer.order.id)} className="text-xs font-medium hover:underline">הזמנה {formatOrderNumber(customer.order.orderNumber)}</Link>
                    ) : (
                      <Link href={paths.admin.manualOrder(customer.id)} className="text-xs font-medium hover:underline">הזמנה ידנית</Link>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
