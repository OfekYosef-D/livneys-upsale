import { notFound } from 'next/navigation';
import { ExistingOrderView } from '@/features/order-additions/components/ExistingOrderView';
import { getCustomerOrderAdditionData } from '@/features/order-additions/queries';
import { getCustomerPortalData } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';

export const dynamic = 'force-dynamic';

export default async function CustomerOrderPage({ params }: { params: Promise<{ customerId: string; orderNumber: string }> }) {
  const { customerId, orderNumber: rawOrderNumber } = await params;
  await requireCustomerPage(customerId);
  const orderNumber = Number(rawOrderNumber);
  if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) notFound();

  const [portal, data] = await Promise.all([
    getCustomerPortalData(customerId),
    getCustomerOrderAdditionData(customerId, orderNumber),
  ]);
  if (!data) notFound();

  return <ExistingOrderView customer={portal.customer} data={data} />;
}
