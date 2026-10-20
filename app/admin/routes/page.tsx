import { AdminShell } from '@/components/admin/AdminShell';
import { RoutesManager } from '@/features/admin-crm/components/RoutesManager';
import { getRouteManagementData } from '@/features/admin-crm/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdminPage(paths.admin.routes);
  const data = await getRouteManagementData();

  return (
    <AdminShell title="קווי חלוקה" activeHref={paths.admin.routes}>
      <RoutesManager data={data} />
    </AdminShell>
  );
}
