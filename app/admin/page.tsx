import { AdminShell } from '@/components/admin/AdminShell';
import { AdminDashboard } from '@/features/admin/components/AdminDashboard';
import { getAdminDashboardData } from '@/features/admin/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  await requireAdmin('/admin');
  const data = await getAdminDashboardData();

  return (
    <AdminShell title="דשבורד CRM" subtitle="שליטה בהזמנות, קווים, תזכורות ואפסייל ללקוחות מוסדיים.">
      <AdminDashboard data={data} />
    </AdminShell>
  );
}
