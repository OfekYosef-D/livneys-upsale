import type { OrderAdditionRequestStatus } from '@prisma/client';

const presentations: Record<OrderAdditionRequestStatus, {
  label: string;
  actionLabel: string;
  canStartNew: boolean;
  tone: string;
}> = {
  DRAFT: { label: 'טיוטה', actionLabel: 'המשך עריכת התוספת', canStartNew: false, tone: 'bg-amber-50 text-amber-900' },
  PENDING: { label: 'ממתינה לאישור', actionLabel: 'עריכת בקשת התוספת', canStartNew: false, tone: 'bg-amber-50 text-amber-900' },
  APPROVED: { label: 'אושרה ונוספה להזמנה', actionLabel: 'הוספת פריטים נוספים', canStartNew: true, tone: 'bg-emerald-50 text-emerald-900' },
  REJECTED: { label: 'נדחתה', actionLabel: 'יצירת בקשה חדשה', canStartNew: true, tone: 'bg-red-50 text-red-900' },
  CANCELLED: { label: 'בוטלה', actionLabel: 'יצירת בקשה חדשה', canStartNew: true, tone: 'bg-black/5 text-black/60' },
};

export function getAdditionRequestPresentation(status: OrderAdditionRequestStatus) {
  return presentations[status];
}

export function getActiveOrderAdminRedirect(
  code: string | undefined,
  details: Record<string, string | number | boolean | null> | undefined,
): string | null {
  if (code !== 'ACTIVE_ORDER_EXISTS' || typeof details?.orderId !== 'string') return null;
  return `/admin/orders/${details.orderId}`;
}

export function getActiveOrderCustomerRedirect(
  customerId: string,
  code: string | undefined,
  details: Record<string, string | number | boolean | null> | undefined,
): string | null {
  if (code !== 'ACTIVE_ORDER_EXISTS' || typeof details?.orderNumber !== 'number') return null;
  return `/customer/${customerId}/orders/${details.orderNumber}`;
}
