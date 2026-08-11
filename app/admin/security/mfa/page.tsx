import { AdminShell } from '@/components/admin/AdminShell';
import { MfaEnrollmentClient } from '@/features/auth/components/MfaEnrollmentClient';
import { requireAdminPage } from '@/lib/authorization';

export const dynamic = 'force-dynamic';

export default async function AdminMfaPage() {
  const session = await requireAdminPage('/admin/security/mfa');
  return (
    <AdminShell title="אבטחת חשבון" subtitle="אימות דו-שלבי הוא חובה לכל מנהל לפני גישה לנתוני הלקוחות." activeHref="/admin">
      <section className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-5 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <MfaEnrollmentClient alreadyEnabled={Boolean(session.user.mfaEnabled)} />
      </section>
    </AdminShell>
  );
}
