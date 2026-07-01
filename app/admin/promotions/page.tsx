import { AdminShell } from '@/components/admin/AdminShell';
import { AdminPromotionsManager } from '@/features/admin-crm/components/AdminCrmManagers';
import { getPromotionManagementData } from '@/features/admin-crm/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminPromotionsPage() {
  await requireAdmin('/admin/promotions');
  const data = await getPromotionManagementData();

  return (
    <AdminShell title="מבצעים" subtitle="מבצעי מוצר פשוטים שמופיעים בהקשר הקטלוג הקיים." activeHref="/admin/promotions">
      <AdminPromotionsManager data={data} />
    </AdminShell>
  );
}
