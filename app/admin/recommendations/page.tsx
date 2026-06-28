import { AdminShell } from '@/components/admin/AdminShell';
import { AdminRecommendationsManager } from '@/features/admin-crm/components/AdminCrmManagers';
import { getRecommendationManagementData } from '@/features/admin-crm/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminRecommendationsPage() {
  await requireAdmin('/admin/recommendations');
  const data = await getRecommendationManagementData();

  return (
    <AdminShell title="המלצות לקוח" subtitle="שיוך ידני של מוצרי אפסייל ללקוחות ללא מנוע המלצות מורכב.">
      <AdminRecommendationsManager data={data} />
    </AdminShell>
  );
}
