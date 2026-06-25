import { AdminShell } from '@/components/admin/AdminShell';
import { CrmRouteDetailClient } from '@/components/admin/CrmRouteDetailClient';
import { requireAdmin } from '@/lib/admin-guard';
import { customers, orders, products, routes } from '@/lib/mock-data';

export default function RoutePage({ params }: { params: { routeId: string } }) {
  requireAdmin(`/admin/routes/${params.routeId}`);

  return (
    <AdminShell title="מוכנות קו" subtitle="רשימת עבודה צפופה וברורה ליום החלוקה.">
      <CrmRouteDetailClient routeId={params.routeId} customers={customers} orders={orders} routes={routes} products={products} />
    </AdminShell>
  );
}
