import { AdminShell } from '@/components/admin/AdminShell';
import { PromotionsManager } from '@/features/admin-crm/components/PromotionsManager';
import { getPromotionManagementData } from '@/features/admin-crm/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdminPage(paths.admin.promotions);
  const data = await getPromotionManagementData();

  return (
    <AdminShell title="מבצעים" activeHref={paths.admin.promotions}>
      <PromotionsManager data={data} />
    </AdminShell>
  );
}
