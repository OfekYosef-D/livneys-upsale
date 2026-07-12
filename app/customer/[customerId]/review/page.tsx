import { ReviewOrderClient } from '@/components/customer/ReviewOrderClient';
import { getCustomerReviewData } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';

export const dynamic = 'force-dynamic';

export default async function Review(props: { params: Promise<{ customerId: string }> }) {
  const params = await props.params;
  await requireCustomerPage(params.customerId);
  const data = await getCustomerReviewData(params.customerId);

  return (
    <ReviewOrderClient
      customer={data.customer}
      route={data.route}
      products={data.products}
      lastOrder={data.lastOrder}
    />
  );
}
