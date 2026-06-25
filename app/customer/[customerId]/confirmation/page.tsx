import { ConfirmationClient } from '@/components/customer/ConfirmationClient';
import { getCustomerConfirmationData } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';

export const dynamic = 'force-dynamic';

export default async function Confirmation({
  params,
  searchParams,
}: {
  params: { customerId: string };
  searchParams: { orderId?: string };
}) {
  await requireCustomerPage(params.customerId);
  const data = await getCustomerConfirmationData(params.customerId, searchParams.orderId);

  return (
    <ConfirmationClient
      customer={data.customer}
      route={data.route}
      products={data.products}
      lastOrder={data.lastOrder}
    />
  );
}
