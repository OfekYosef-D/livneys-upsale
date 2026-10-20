import Link from 'next/link';
import { ActiveBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/Notice';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { DefinitionItem, DefinitionList } from '@/components/ui/Toolbar';
import { formatDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { paths } from '@/lib/paths';
import { CustomerUsersManager } from '../../auth/components/CustomerUsersManager';
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge';
import { formatOrderNumber } from '../../orders/status';
import type { AdminCustomerDetailData } from '../queries';

export function AdminCustomerDetail({ customer }: { customer: AdminCustomerDetailData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
      <aside className="space-y-4">
        <Panel className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <ActiveBadge active={customer.isActive} />
            <span className="text-xs text-black/55">{customer.priceListName}</span>
          </div>
          <DefinitionList>
            <DefinitionItem label="איש קשר">{customer.contact}</DefinitionItem>
            <DefinitionItem label="טלפון"><a href={`tel:${customer.phone}`} className="hover:underline" dir="ltr">{customer.phone}</a></DefinitionItem>
            <DefinitionItem label="אימייל"><span dir="ltr" className="break-all">{customer.email ?? '—'}</span></DefinitionItem>
            <DefinitionItem label="קו"><Link href={paths.admin.route(customer.routeId)} className="hover:underline">{customer.routeName}</Link></DefinitionItem>
            <DefinitionItem label="כתובת">{customer.address}</DefinitionItem>
            <DefinitionItem label="אזור">{customer.region}</DefinitionItem>
          </DefinitionList>
          {customer.deliveryConstraints && <p className="rounded-md bg-[var(--pantry-soft)] p-2.5 text-xs"><span className="font-semibold">אילוצי חלוקה: </span>{customer.deliveryConstraints}</p>}
          {customer.notes && <p className="rounded-md bg-[var(--pantry-soft)] p-2.5 text-xs">{customer.notes}</p>}
          <Button href={paths.admin.manualOrder(customer.id)} fullWidth>הזמנה ידנית ללקוח</Button>
        </Panel>

        <CustomerUsersManager customerId={customer.id} accounts={customer.users} />

        <Panel>
          <PanelHeader title="מוצרים מומלצים" actions={<Link href={paths.admin.recommendations} className="text-xs hover:underline">ניהול</Link>} />
          {customer.recommendations.length === 0 ? (
            <p className="p-4 text-xs text-black/50">אין המלצות פעילות. המלצות מופיעות ללקוח בקטלוג תחת &quot;מומלץ עבורכם&quot;.</p>
          ) : (
            <ul className="divide-y divide-[var(--pantry-line)]">
              {customer.recommendations.map((recommendation) => (
                <li key={recommendation.productName} className="px-4 py-2 text-sm">
                  <p className="font-medium">{recommendation.productName}</p>
                  {recommendation.reason && <p className="text-xs text-black/55">{recommendation.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </aside>

      <Panel>
        <PanelHeader title="היסטוריית הזמנות" description={`${customer.orders.length} הזמנות אחרונות`} />
        {customer.orders.length === 0 ? (
          <EmptyState title="אין עדיין הזמנות" />
        ) : (
          <DataTable minWidth="28rem">
            <thead>
              <tr>
                <Th>הזמנה</Th>
                <Th>סטטוס</Th>
                <Th>סכום כולל מע״מ</Th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((order) => (
                <tr key={order.id} className="hover:bg-[var(--pantry-soft)]">
                  <Td>
                    <Link href={paths.admin.order(order.id)} className="font-medium hover:underline">{formatOrderNumber(order.orderNumber)}</Link>
                    <p className="text-xs text-black/50">חלוקה {formatDate(order.deliveryWindowStart)}</p>
                  </Td>
                  <Td><OrderStatusBadge status={order.status} /></Td>
                  <Td className="tabular-nums">{formatMoney(order.totalIncludingVat)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
