import { AdminShell } from '@/components/admin/AdminShell';
import { AdminPriceListsManager } from '@/features/admin-crm/components/AdminCrmManagers';
import { getPriceListManagementData } from '@/features/admin-crm/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminPriceListsPage() {
  await requireAdmin('/admin/price-lists');
  const data = await getPriceListManagementData();

  return (
    <AdminShell title="מחירונים" subtitle="ניהול מלא של מחירי מוצרים לפי מחירון, שכפול מחירונים ושיוך ללקוחות.">
      <AdminPriceListsManager data={data} />
    </AdminShell>
  );
}
