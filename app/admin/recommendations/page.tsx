import { AdminShell } from '@/components/admin/AdminShell';
import { RecommendationsManager } from '@/features/admin-crm/components/RecommendationsManager';
import { getRecommendationManagementData } from '@/features/admin-crm/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdminPage(paths.admin.recommendations);
  const data = await getRecommendationManagementData();

  return (
    <AdminShell title="המלצות ללקוחות" activeHref={paths.admin.recommendations}>
      <RecommendationsManager data={data} />
    </AdminShell>
  );
}
