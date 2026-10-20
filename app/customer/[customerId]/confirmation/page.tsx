import { notFound } from 'next/navigation';
import { CustomerOrderView } from '@/features/customer-portal/components/CustomerOrderView';
import { getCustomerOrderById, getPortalCustomer } from '@/features/customer-portal/queries';
import { requireCustomerPage } from '@/lib/authorization';
import { canAddItems } from '@/features/orders/status';

export const dynamic = 'force-dynamic';

export default async function CustomerConfirmationPage(props: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ orderId?: string }>;
}) {
  const [{ customerId }, { orderId }] = await Promise.all([props.params, props.searchParams]);
  await requireCustomerPage(customerId);
  if (!orderId) notFound();

  const [customer, order] = await Promise.all([getPortalCustomer(customerId), getCustomerOrderById(customerId, orderId)]);
  if (!order) notFound();

  return <CustomerOrderView customer={customer} order={order} canAddItems={canAddItems(order.status)} latestAddition={null} justPlaced />;
}
