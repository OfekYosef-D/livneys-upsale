import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminCustomerDetail } from '@/features/admin/components/AdminCustomerDetail';
import { getAdminCustomerDetail } from '@/features/admin/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function CustomerProfile(props: { params: Promise<{ customerId: string }> }) {
  const params = await props.params;
  await requireAdmin(`/admin/customers/${params.customerId}`);
  const customer = await getAdminCustomerDetail(params.customerId);

  if (!customer) {
    notFound();
  }

  return (
    <AdminShell title={customer.name} subtitle="פרופיל לקוח, היסטוריית הזמנות והמלצות אפסייל." activeHref="/admin/customers">
      <AdminCustomerDetail customer={customer} />
    </AdminShell>
  );
}
