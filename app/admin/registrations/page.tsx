import { AdminShell } from '@/components/admin/AdminShell';
import { AdminRegistrationsClient } from '@/features/registration/components/AdminRegistrationsClient';
import { getRegistrationManagementData } from '@/features/registration/queries';
import { getAppBaseUrl } from '@/features/notifications/config';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdminPage(paths.admin.registrations);
  const data = await getRegistrationManagementData();

  return (
    <AdminShell title="בקשות הצטרפות" activeHref={paths.admin.registrations}>
      <AdminRegistrationsClient data={data} appOrigin={getAppBaseUrl()} />
    </AdminShell>
  );
}
