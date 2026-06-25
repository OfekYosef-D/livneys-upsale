import { CustomerCatalogApp } from '@/components/customer/CustomerCatalogApp';
import { getCustomer, getLastOrder, getRoute, products } from '@/lib/mock-data';

export default function CustomerHome({ params }: { params: { customerId: string } }) {
  const customer = getCustomer(params.customerId);
  const route = getRoute(customer.routeId);
  const lastOrder = getLastOrder(customer.id);

  return (
    <CustomerCatalogApp
      customer={customer}
      route={route}
      products={products}
      lastOrder={lastOrder}
    />
  );
}
