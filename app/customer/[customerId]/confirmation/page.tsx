import { ConfirmationClient } from '@/components/customer/ConfirmationClient';
import { getCustomer, getLastOrder, getRoute, products } from '@/lib/mock-data';

export default function Confirmation({ params }: { params: { customerId: string } }) {
  const customer = getCustomer(params.customerId);
  const route = getRoute(customer.routeId);
  const lastOrder = getLastOrder(customer.id);

  return <ConfirmationClient customer={customer} route={route} products={products} lastOrder={lastOrder} />;
}
