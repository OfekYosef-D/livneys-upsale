import { AdminShell } from '@/components/admin/AdminShell';
import { AdminRegistrationsClient } from '@/features/registration/components/AdminRegistrationsClient';
import { getRegistrationManagementData } from '@/features/registration/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AdminRegistrationsPage() {
  await requireAdmin('/admin/registrations');
  const data = await getRegistrationManagementData();

  return (
    <AdminShell title="הרשמות חדשות" subtitle="בקשות מחברות חדשות, בדיקה תפעולית והמרה ללקוח פעיל." activeHref="/admin/registrations">
      <AdminRegistrationsClient data={data} />
    </AdminShell>
  );
}
