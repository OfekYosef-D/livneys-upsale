import { AdminShell } from '@/components/admin/AdminShell';
import { AdminCustomersManager } from '@/features/admin-crm/components/AdminCrmManagers';
import { getCustomerManagementData } from '@/features/admin-crm/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  await requireAdmin('/admin/customers');
  const data = await getCustomerManagementData();

  return (
    <AdminShell title="ניהול לקוחות" subtitle="יצירה, עריכה והפעלה של לקוחות, קווים, מחירונים והעדפות הודעה." activeHref="/admin/customers">
      <AdminCustomersManager data={data} />
    </AdminShell>
  );
}
