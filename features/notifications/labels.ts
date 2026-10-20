import type { NotificationChannel, NotificationJobStatus } from '@prisma/client';

export const notificationStatusLabels: Record<NotificationJobStatus, string> = {
  PENDING: 'ממתינה לשליחה',
  PROCESSING: 'בשליחה',
  DRY_RUN: 'לא נשלחה (מצב בדיקה)',
  SENT: 'נשלחה',
  FAILED: 'נכשלה',
  CANCELLED: 'בוטלה',
};

export const notificationTemplateLabels: Record<string, string> = {
  ORDER_REMINDER: 'תזכורת להזמנה',
  ORDER_RECEIVED: 'הזמנה התקבלה',
  ORDER_SPECIAL_REQUEST: 'בקשה מיוחדת',
  ORDER_APPROVED: 'הזמנה אושרה',
  ORDER_PACKED: 'הזמנה נארזה',
  ORDER_DELIVERED: 'הזמנה סופקה',
  ORDER_CANCELLED: 'הזמנה בוטלה',
  ORDER_ADDITION_APPROVED: 'תוספת אושרה',
  ORDER_ADDITION_REJECTED: 'תוספת נדחתה',
};

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  EMAIL: 'אימייל',
  WHATSAPP: 'WhatsApp',
};

/** Failures first, then what still needs to go out, then history. */
const operatorRank: Record<NotificationJobStatus, number> = { FAILED: 0, PENDING: 1, PROCESSING: 2, DRY_RUN: 3, SENT: 4, CANCELLED: 5 };

export function compareJobsForOperator(
  a: { status: NotificationJobStatus; scheduledAt: string },
  b: { status: NotificationJobStatus; scheduledAt: string },
): number {
  return operatorRank[a.status] - operatorRank[b.status] || b.scheduledAt.localeCompare(a.scheduledAt);
}
