export type JobStatusFilter = 'all' | 'PENDING' | 'PROCESSING' | 'DRY_RUN' | 'SENT' | 'FAILED';

export const notificationJobStatusLabels: Record<string, string> = {
  PENDING: 'ממתינה לשליחה',
  PROCESSING: 'בתהליך שליחה',
  DRY_RUN: 'בדיקה בלבד',
  SENT: 'נשלחה',
  FAILED: 'נכשלה',
  CANCELLED: 'בוטלה',
};

export const notificationJobFilterLabels: Record<JobStatusFilter, string> = {
  all: 'הכל',
  PENDING: 'ממתינות לשליחה',
  PROCESSING: 'בתהליך שליחה',
  DRY_RUN: 'בדיקה בלבד',
  SENT: 'נשלחו',
  FAILED: 'נכשלו',
};

export const notificationTemplateLabels: Record<string, string> = {
  ORDER_REMINDER: 'תזכורת הזמנה',
  ORDER_RECEIVED: 'הזמנה התקבלה',
  ORDER_APPROVED: 'הזמנה אושרה',
  ORDER_PACKED: 'הזמנה נארזה',
  ORDER_DELIVERED: 'הזמנה סופקה',
  ORDER_CANCELLED: 'הזמנה בוטלה',
  ORDER_SPECIAL_REQUEST: 'בקשה מיוחדת',
};

export type OperatorNotificationJob = {
  status: string;
  scheduledAt: string;
  customerName: string;
  customerContact: string;
  customerPhone: string;
  templateKey: string;
  templateName: string | null;
  orderId: string | null;
  orderNumber: number | null;
  providerMessageId: string | null;
  message: string | null;
  errorMessage: string | null;
};

const operatorStatusRank: Record<string, number> = {
  FAILED: 0,
  PENDING: 1,
  PROCESSING: 2,
  DRY_RUN: 3,
  SENT: 4,
  CANCELLED: 5,
};

export function compareJobsForOperator<T extends OperatorNotificationJob>(a: T, b: T): number {
  const statusDiff = (operatorStatusRank[a.status] ?? 9) - (operatorStatusRank[b.status] ?? 9);
  if (statusDiff !== 0) return statusDiff;

  return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();
}

export function filterNotificationJobsForOperator<T extends OperatorNotificationJob>(
  jobs: T[],
  search: string,
  status: JobStatusFilter,
): T[] {
  const normalizedSearch = search.trim().toLowerCase();

  return jobs
    .filter((job) => {
      const matchesStatus = status === 'all' || job.status === status;
      const haystack = [
        job.customerName,
        job.customerContact,
        job.customerPhone,
        job.templateKey,
        job.templateName,
        job.orderId,
        job.orderNumber,
        job.providerMessageId,
        job.message,
        job.errorMessage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (normalizedSearch.length === 0 || haystack.includes(normalizedSearch));
    })
    .sort(compareJobsForOperator);
}
