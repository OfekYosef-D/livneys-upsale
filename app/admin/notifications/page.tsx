import { AdminShell } from '@/components/admin/AdminShell';
import { AdminNotificationsClient } from '@/features/notifications/components/AdminNotificationsClient';
import { getNotificationManagementData } from '@/features/notifications/queries';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage(props: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage(paths.admin.notifications());
  const [data, { q }] = await Promise.all([getNotificationManagementData(), props.searchParams]);

  return (
    <AdminShell title="הודעות ותזכורות" activeHref={paths.admin.notifications()}>
      <AdminNotificationsClient data={data} initialSearch={q ?? ''} />
    </AdminShell>
  );
}
