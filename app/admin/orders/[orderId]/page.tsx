import { AdminShell } from '@/components/admin/AdminShell';
import { CrmOrderDetailClient } from '@/components/admin/CrmOrderDetailClient';
import { requireAdmin } from '@/lib/admin-guard';
import { customers, orders, products, routes } from '@/lib/mock-data';

export default function AdminOrderPage({ params }: { params: { orderId: string } }) {
  requireAdmin(`/admin/orders/${params.orderId}`);

  return (
    <AdminShell title="טיפול בהזמנה" subtitle="קבלה תפעולית קצרה: פריטים, לקוח, קו ופעולות סטטוס.">
      <CrmOrderDetailClient orderId={params.orderId} customers={customers} orders={orders} routes={routes} products={products} />
    </AdminShell>
  );
}
