import { notFound } from 'next/navigation';
import { CustomerOrderView } from '@/features/customer-portal/components/CustomerOrderView';
import { getCustomerOrderDetail, getPortalCustomer } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';
import { parseOrderNumber } from '@/features/orders/status';

export const dynamic = 'force-dynamic';

export default async function CustomerOrderPage(props: { params: Promise<{ customerId: string; orderNumber: string }> }) {
  const { customerId, orderNumber } = await props.params;
  await requireCustomerPage(customerId);
  const number = parseOrderNumber(orderNumber);
  if (!number) notFound();

  const [customer, detail] = await Promise.all([getPortalCustomer(customerId), getCustomerOrderDetail(customerId, number)]);
  if (!detail) notFound();

  return <CustomerOrderView customer={customer} {...detail} />;
}
