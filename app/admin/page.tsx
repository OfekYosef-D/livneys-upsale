import { AdminShell } from '@/components/admin/AdminShell';
import { AdminDashboard } from '@/features/admin/components/AdminDashboard';
import { getAdminDashboardData } from '@/features/admin/queries';
import { getAppBaseUrl } from '@/features/notifications/config';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdminPage(paths.admin.home);
  const data = await getAdminDashboardData();

  return (
    <AdminShell title="לוח עבודה" activeHref={paths.admin.home}>
      <AdminDashboard data={data} appOrigin={getAppBaseUrl()} />
    </AdminShell>
  );
}
