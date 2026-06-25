import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDashboardClient } from '@/components/admin/CrmDashboardClient';
import { requireAdmin } from '@/lib/admin-guard';
import { customers, orders, products, promotions, routes } from '@/lib/mock-data';

export default function Admin() {
  requireAdmin('/admin');

  return (
    <AdminShell title="דשבורד CRM" subtitle="שליטה בהזמנות, מעקב לקוחות והזדמנויות מכירה לשיחה של 30 שניות.">
      <CrmDashboardClient customers={customers} orders={orders} routes={routes} products={products} promotions={promotions} />
    </AdminShell>
  );
}
