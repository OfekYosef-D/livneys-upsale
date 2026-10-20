import { redirect } from 'next/navigation';
import { ReviewOrderClient } from '@/features/customer-portal/components/ReviewOrderClient';
import { getCustomerPortalData } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function CustomerReviewPage(props: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await props.params;
  await requireCustomerPage(customerId);
  const data = await getCustomerPortalData(customerId);

  if (data.activeOrder) redirect(paths.customer.order(customerId, data.activeOrder.orderNumber));

  return <ReviewOrderClient data={data} />;
}
