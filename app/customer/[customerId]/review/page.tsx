import { ReviewOrderClient } from '@/components/customer/ReviewOrderClient';
import { getCustomer, getLastOrder, getRoute, products } from '@/lib/mock-data';

export default function Review({ params }: { params: { customerId: string } }) {
  const customer = getCustomer(params.customerId);
  const route = getRoute(customer.routeId);
  const lastOrder = getLastOrder(customer.id);

  return <ReviewOrderClient customer={customer} route={route} products={products} lastOrder={lastOrder} />;
}
