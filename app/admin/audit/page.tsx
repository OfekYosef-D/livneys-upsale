import { AdminShell } from '@/components/admin/AdminShell';
import { AdminAuditLog } from '@/features/audit/components/AdminAuditLog';
import { getAuditLogEntries } from '@/features/audit/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function AuditPage(props: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage(paths.admin.audit);
  const { q } = await props.searchParams;
  const query = typeof q === 'string' ? q.slice(0, 160) : '';
  const entries = await getAuditLogEntries(query);

  return (
    <AdminShell title="יומן פעולות" activeHref={paths.admin.audit}>
      <AdminAuditLog entries={entries} query={query} />
    </AdminShell>
  );
}
