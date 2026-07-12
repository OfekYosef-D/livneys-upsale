import { CustomerCatalogApp } from '@/components/customer/CustomerCatalogApp';
import { getCustomerPortalData } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';

export const dynamic = 'force-dynamic';

export default async function CustomerHome(props: { params: Promise<{ customerId: string }> }) {
  const params = await props.params;
  await requireCustomerPage(params.customerId);
  const data = await getCustomerPortalData(params.customerId);

  return (
    <CustomerCatalogApp
      customer={data.customer}
      route={data.route}
      products={data.products}
      lastOrder={data.lastOrder}
    />
  );
}
