import { AdminShell } from '@/components/admin/AdminShell';
import { CustomersManager } from '@/features/admin-crm/components/CustomersManager';
import { getCustomerManagementData } from '@/features/admin-crm/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdminPage(paths.admin.customers);
  const data = await getCustomerManagementData();

  return (
    <AdminShell title="לקוחות" activeHref={paths.admin.customers}>
      <CustomersManager data={data} />
    </AdminShell>
  );
}
