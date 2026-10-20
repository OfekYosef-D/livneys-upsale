import { redirect } from 'next/navigation';
import { CatalogClient } from '@/features/customer-portal/components/CatalogClient';
import { getCustomerPortalData } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function CustomerCatalogPage(props: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await props.params;
  await requireCustomerPage(customerId);
  const data = await getCustomerPortalData(customerId);

  // One order per delivery: once placed, the customer manages it (and its additions) instead.
  if (data.activeOrder) redirect(paths.customer.order(customerId, data.activeOrder.orderNumber));

  return <CatalogClient data={data} />;
}
