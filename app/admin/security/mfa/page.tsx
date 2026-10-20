import { AdminShell } from '@/components/admin/AdminShell';
import { MfaEnrollmentClient } from '@/features/auth/components/MfaEnrollmentClient';
import { requireAdminPage } from '@/lib/authorization';
import { paths } from '@/lib/paths';

export const dynamic = 'force-dynamic';

export default async function AdminSecurityPage() {
  const session = await requireAdminPage(paths.admin.security);
  return (
    <AdminShell title="אבטחת החשבון" activeHref={paths.admin.security}>
      <section className="ui-panel mx-auto max-w-xl p-5">
        <MfaEnrollmentClient alreadyEnabled={Boolean(session.user.mfaEnabled)} />
      </section>
    </AdminShell>
  );
}
