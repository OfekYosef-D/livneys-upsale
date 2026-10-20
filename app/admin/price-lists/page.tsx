import { AdminShell } from '@/components/admin/AdminShell';
import { PriceListsManager } from '@/features/admin-crm/components/PriceListsManager';
import { getPriceListManagementData } from '@/features/admin-crm/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdminPage(paths.admin.priceLists);
  const data = await getPriceListManagementData();

  return (
    <AdminShell title="מחירונים" activeHref={paths.admin.priceLists}>
      <PriceListsManager data={data} />
    </AdminShell>
  );
}
