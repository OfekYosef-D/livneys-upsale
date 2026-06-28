import { AdminShell } from '@/components/admin/AdminShell';
import { AdminProductsManager } from '@/features/admin-crm/components/AdminCrmManagers';
import { getProductManagementData } from '@/features/admin-crm/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  await requireAdmin('/admin/products');
  const data = await getProductManagementData();

  return (
    <AdminShell title="ניהול מוצרים" subtitle="מוצרים, מחירי בסיס, כמויות מינימום והפעלה ללא פגיעה בהיסטוריית הזמנות.">
      <AdminProductsManager data={data} />
    </AdminShell>
  );
}
