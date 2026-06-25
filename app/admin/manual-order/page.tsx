import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export default async function ManualOrderPage() {
  await requireAdmin('/admin/manual-order');

  return (
    <AdminShell title="הזמנה ידנית" subtitle="יצירת הזמנה ידנית תתווסף אחרי שהזרימה הראשונה יציבה.">
      <section className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-xl font-black">TODO: הזמנה ידנית</h2>
        <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-black/55">
          השלב הראשון מתמקד בהזמנה אמיתית של לקוח דרך הפורטל והצגה ב-CRM. במסירה הבאה נחבר כאן יצירת הזמנה ידנית עם אותו מנגנון
          תמחור ו-Snapshot של שורות הזמנה.
        </p>
      </section>
    </AdminShell>
  );
}
