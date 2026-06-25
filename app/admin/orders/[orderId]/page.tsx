import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminOrderDetail } from '@/features/admin/components/AdminOrderDetail';
import { getAdminOrderDetail } from '@/features/admin/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminOrderPage({ params }: { params: { orderId: string } }) {
  await requireAdmin(`/admin/orders/${params.orderId}`);
  const order = await getAdminOrderDetail(params.orderId);

  if (!order) {
    notFound();
  }

  return (
    <AdminShell title={`הזמנה ${order.id}`} subtitle="שורות ההזמנה נשמרות עם Snapshot של שם ומחיר בזמן השליחה.">
      <AdminOrderDetail order={order} />
    </AdminShell>
  );
}
