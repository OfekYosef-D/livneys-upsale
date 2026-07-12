import { ConfirmationClient } from '@/components/customer/ConfirmationClient';
import { getCustomerConfirmationData } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';

export const dynamic = 'force-dynamic';

export default async function Confirmation(
  props: {
    params: Promise<{ customerId: string }>;
    searchParams: Promise<{ orderId?: string }>;
  },
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
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
