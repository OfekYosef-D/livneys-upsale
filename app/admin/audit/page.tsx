import { AdminShell } from '@/components/admin/AdminShell';
import { AdminAuditLog } from '@/features/audit/components/AdminAuditLog';
import { getAuditLogEntries } from '@/features/audit/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function AuditPage(props: { searchParams?: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  await requireAdmin('/admin/audit');
  const query = typeof searchParams?.q === 'string' ? searchParams.q.slice(0, 160) : '';
  const entries = await getAuditLogEntries(query);
  return (
    <AdminShell title="יומן ביקורת" subtitle="תיעוד בלתי ניתן לעריכה של פעולות עסקיות ורגישות במערכת." activeHref="/admin/audit">
      <AdminAuditLog entries={entries} query={query} />
    </AdminShell>
  );
}
