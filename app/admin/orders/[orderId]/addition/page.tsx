import { notFound, redirect } from 'next/navigation';
import { AdditionCatalogClient } from '@/features/order-additions/components/AdditionCatalogClient';
import { getAdminOrderDetail } from '@/features/admin/queries';
import { getCustomerPortalData } from '@/features/customer-portal/queries';
import { canAddItems } from '@/features/orders/status';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function AdminOrderAdditionPage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params;
  await requireAdminPage(paths.admin.orderAddition(orderId));
  const order = await getAdminOrderDetail(orderId);
  if (!order) notFound();
  if (!canAddItems(order.status)) redirect(paths.admin.order(order.id));

  const portal = await getCustomerPortalData(order.customerId);
  return (
    <AdditionCatalogClient
      customerId={order.customerId}
      products={portal.products}
      order={order}
      initialLines={[]}
      mode="admin"
      returnHref={paths.admin.order(order.id)}
    />
  );
}
