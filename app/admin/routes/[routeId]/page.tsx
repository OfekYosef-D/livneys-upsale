import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminRouteDetail } from '@/features/admin/components/AdminRouteDetail';
import { getAdminRouteDetail } from '@/features/admin/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function RoutePage({ params }: { params: { routeId: string } }) {
  await requireAdmin(`/admin/routes/${params.routeId}`);
  const route = await getAdminRouteDetail(params.routeId);

  if (!route) {
    notFound();
  }

  return (
    <AdminShell title={`קו ${route.name}`} subtitle="מבט לפי קו: מי הזמין, מי חסר ומה מוכן לחלוקה.">
      <AdminRouteDetail route={route} />
    </AdminShell>
  );
}
