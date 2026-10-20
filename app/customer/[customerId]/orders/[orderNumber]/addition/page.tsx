import { notFound, redirect } from 'next/navigation';
import { AdditionCatalogClient } from '@/features/order-additions/components/AdditionCatalogClient';
import { isAdditionEditable } from '@/features/order-additions/view-model';
import { getCustomerOrderDetail, getCustomerPortalData } from '@/features/customer-portal/queries';
import { parseOrderNumber } from '@/features/orders/status';
import { requireCustomerPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function CustomerOrderAdditionPage(props: { params: Promise<{ customerId: string; orderNumber: string }> }) {
  const { customerId, orderNumber } = await props.params;
  await requireCustomerPage(customerId);
  const number = parseOrderNumber(orderNumber);
  if (!number) notFound();

  const [portal, detail] = await Promise.all([getCustomerPortalData(customerId), getCustomerOrderDetail(customerId, number)]);
  if (!detail) notFound();
  const orderHref = paths.customer.order(customerId, number);
  if (!detail.canAddItems) redirect(orderHref);

  const pendingAddition = detail.latestAddition && isAdditionEditable(detail.latestAddition.status) ? detail.latestAddition : null;
  return (
    <AdditionCatalogClient
      customerId={customerId}
      products={portal.products}
      order={detail.order}
      initialLines={pendingAddition?.lines ?? []}
      mode="customer"
      returnHref={orderHref}
    />
  );
}
