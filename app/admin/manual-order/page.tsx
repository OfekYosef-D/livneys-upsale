import { AdminShell } from '@/components/admin/AdminShell';
import { AdminManualOrderClient } from '@/features/admin-crm/components/AdminCrmManagers';
import { getManualOrderData } from '@/features/admin-crm/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function ManualOrderPage() {
  await requireAdmin('/admin/manual-order');
  const data = await getManualOrderData();

  return (
    <AdminShell title="הזמנה ידנית" subtitle="יצירת הזמנה אמיתית ללקוח שמזמין בטלפון, WhatsApp או דרך הצוות.">
      <AdminManualOrderClient data={data} />
    </AdminShell>
  );
}
