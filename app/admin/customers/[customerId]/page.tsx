import { AdminShell } from '@/components/admin/AdminShell';
import { CrmCustomerProfileClient } from '@/components/admin/CrmCustomerProfileClient';
import { requireAdmin } from '@/lib/admin-guard';
import { customers, orders, products, promotions, routes } from '@/lib/mock-data';

export default function CustomerProfile({ params }: { params: { customerId: string } }) {
  requireAdmin(`/admin/customers/${params.customerId}`);

  return (
    <AdminShell title="פרופיל לקוח" subtitle="כל מה שצריך כדי להחליט אם להתקשר, לאשר הזמנה או להציע מוצר נוסף.">
      <CrmCustomerProfileClient customerId={params.customerId} customers={customers} orders={orders} routes={routes} products={products} promotions={promotions} />
    </AdminShell>
  );
}
