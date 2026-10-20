import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminOrderDetail } from '@/features/admin/components/AdminOrderDetail';
import { getAdminOrderDetail } from '@/features/admin/queries';
import { formatOrderNumber } from '@/features/orders/status';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function AdminOrderPage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params;
  await requireAdminPage(paths.admin.order(orderId));
  const order = await getAdminOrderDetail(orderId);
  if (!order) notFound();

  return (
    <AdminShell title={`הזמנה ${formatOrderNumber(order.orderNumber)} · ${order.customerName}`} activeHref={paths.admin.home}>
      <AdminOrderDetail order={order} />
    </AdminShell>
  );
}
