import { AdminShell } from '@/components/admin/AdminShell';
import { AdminRoutesManager } from '@/features/admin-crm/components/AdminCrmManagers';
import { getRouteManagementData } from '@/features/admin-crm/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminRoutesPage() {
  await requireAdmin('/admin/routes');
  const data = await getRouteManagementData();

  return (
    <AdminShell title="ניהול קווים" subtitle="חלונות חלוקה, דדליינים, נהגים ואנשי קשר תפעוליים." activeHref="/admin/routes">
      <AdminRoutesManager data={data} />
    </AdminShell>
  );
}
