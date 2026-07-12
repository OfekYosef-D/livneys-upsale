import { AdminShell } from '@/components/admin/AdminShell';
import { AdminNotificationsClient } from '@/features/notifications/components/AdminNotificationsClient';
import { getNotificationManagementData } from '@/features/notifications/queries';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({ searchParams }: { searchParams?: { q?: string } }) {
  await requireAdmin('/admin/notifications');
  const data = await getNotificationManagementData();
  const initialSearch = typeof searchParams?.q === 'string' ? searchParams.q : '';

  return (
    <AdminShell title="הודעות WhatsApp" subtitle="תקלות, הודעות שמחכות לשליחה ותזכורות לפני חלוקה במקום אחד." activeHref="/admin/notifications">
      <AdminNotificationsClient data={data} initialSearch={initialSearch} />
    </AdminShell>
  );
}
