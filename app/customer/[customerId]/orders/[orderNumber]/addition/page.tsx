import { notFound, redirect } from 'next/navigation';
import { AdditionCatalogClient } from '@/features/order-additions/components/AdditionCatalogClient';
import { getCustomerOrderAdditionData } from '@/features/order-additions/queries';
import { getCustomerPortalData } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';

export const dynamic = 'force-dynamic';

export default async function CustomerOrderAdditionPage({ params }: { params: Promise<{ customerId: string; orderNumber: string }> }) {
  const { customerId, orderNumber: rawOrderNumber } = await params;
  await requireCustomerPage(customerId);
  const orderNumber = Number(rawOrderNumber);
  if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) notFound();

  const [portal, data] = await Promise.all([
    getCustomerPortalData(customerId),
    getCustomerOrderAdditionData(customerId, orderNumber),
  ]);
  if (!data) notFound();
  if (!data.canAddItems) redirect(`/customer/${customerId}/orders/${orderNumber}`);

  const editableLines = data.additionRequest && ['DRAFT', 'PENDING'].includes(data.additionRequest.status)
    ? data.additionRequest.lines
    : [];
  return (
    <AdditionCatalogClient
      customer={portal.customer}
      products={portal.products}
      order={data.order}
      initialLines={editableLines}
    />
  );
}
