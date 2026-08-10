import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminOrderDetail } from '@/features/admin/components/AdminOrderDetail';
import { getAdminOrderDetail } from '@/features/admin/queries';
import { formatOrderNumber } from '@/features/orders/order-number';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminOrderPage(props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  await requireAdmin(`/admin/orders/${params.orderId}`);
  const order = await getAdminOrderDetail(params.orderId);

  if (!order) {
    notFound();
  }

  return (
    <AdminShell title={`הזמנה ${formatOrderNumber(order.orderNumber)}`} subtitle="שורות ההזמנה נשמרות עם תמונת מצב של שם ומחיר בזמן השליחה." activeHref="/admin">
      <AdminOrderDetail order={order} />
    </AdminShell>
  );
}
