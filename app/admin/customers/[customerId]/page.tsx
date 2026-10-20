import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminCustomerDetail } from '@/features/admin/components/AdminCustomerDetail';
import { getAdminCustomerDetail } from '@/features/admin/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function AdminCustomerPage(props: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await props.params;
  await requireAdminPage(paths.admin.customer(customerId));
  const customer = await getAdminCustomerDetail(customerId);
  if (!customer) notFound();

  return (
    <AdminShell title={customer.name} activeHref={paths.admin.customers}>
      <AdminCustomerDetail customer={customer} />
    </AdminShell>
  );
}
