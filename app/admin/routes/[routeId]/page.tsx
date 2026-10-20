import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminRouteDetail } from '@/features/admin/components/AdminRouteDetail';
import { getAdminRouteDetail } from '@/features/admin/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function AdminRoutePage(props: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await props.params;
  await requireAdminPage(paths.admin.route(routeId));
  const route = await getAdminRouteDetail(routeId);
  if (!route) notFound();

  return (
    <AdminShell title={`קו ${route.name}`} subtitle="מי הזמין לחלוקה הקרובה ומי עוד לא." activeHref={paths.admin.routes}>
      <AdminRouteDetail route={route} />
    </AdminShell>
  );
}
