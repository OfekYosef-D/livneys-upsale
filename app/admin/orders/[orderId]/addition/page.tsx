import { notFound, redirect } from 'next/navigation';
import { AdditionCatalogClient } from '@/features/order-additions/components/AdditionCatalogClient';
import { getAdminOrderDetail } from '@/features/admin/queries';
import { getCustomerPortalData } from '@/features/customer-portal/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminOrderAdditionPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  await requireAdmin(`/admin/orders/${orderId}/addition`);
  const order = await getAdminOrderDetail(orderId);
  if (!order) notFound();
  if (!['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED'].includes(order.status)) redirect(`/admin/orders/${order.id}`);
  const portal = await getCustomerPortalData(order.customerId);

  return (
    <AdditionCatalogClient
      customer={portal.customer}
      products={portal.products}
      order={{
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        date: order.submittedAt ?? new Date().toISOString(),
        status: order.status,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        paymentTerm: order.paymentTerm,
        paymentDiscountPercent: order.paymentDiscountPercent,
        paymentDiscountTotal: order.paymentDiscountTotal,
        total: order.total,
        vatRatePercent: order.vatRatePercent,
        vatTotal: order.vatTotal,
        totalIncludingVat: order.totalIncludingVat,
        commercialTermsVersion: order.commercialTermsVersion,
        commercialTermsAcceptedAt: order.commercialTermsAcceptedAt,
        items: order.lines.flatMap((line) => line.productId ? [{
          productId: line.productId,
          productName: line.productName,
          qty: line.quantity,
          listUnitPrice: line.listUnitPrice,
          unitPrice: line.unitPrice,
          lineSubtotal: line.lineSubtotal,
          discountTotal: line.discountTotal,
          lineTotal: line.lineTotal,
          promotionLabel: line.promotionLabel,
        }] : []),
      }}
      initialLines={[]}
      mode="admin"
    />
  );
}
