import { AdminShell } from '@/components/admin/AdminShell';
import { ManualOrderClient } from '@/features/admin-crm/components/ManualOrderClient';
import { getManualOrderData } from '@/features/admin-crm/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function ManualOrderPage(props: { searchParams: Promise<{ customerId?: string }> }) {
  await requireAdminPage(paths.admin.manualOrder());
  const [data, { customerId }] = await Promise.all([getManualOrderData(), props.searchParams]);

  return (
    <AdminShell title="הזמנה ידנית" subtitle="להזמנות שהתקבלו בטלפון או בוואטסאפ." activeHref={paths.admin.manualOrder()}>
      <ManualOrderClient data={data} initialCustomerId={customerId} />
    </AdminShell>
  );
}
