import { AdminShell } from '@/components/admin/AdminShell';
import { ManualOrderClient } from '@/components/admin/ManualOrderClient';
import { requireAdmin } from '@/lib/admin-guard';
import { customers, products } from '@/lib/mock-data';

export default function ManualOrder() {
  requireAdmin('/admin/manual-order');

  return (
    <AdminShell title="הזמנה ידנית" subtitle="הזנה מהירה להזמנות שהתקבלו בטלפון או בוואטסאפ.">
      <ManualOrderClient customers={customers} products={products} />
    </AdminShell>
  );
}
