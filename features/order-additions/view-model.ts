import type { OrderAdditionRequestStatus, Prisma } from '@prisma/client';
import { toOrderTotals } from '../orders/totals';
import type { AdditionRequestView } from '../customer-portal/types';

export const additionRequestViewInclude = {
  lines: { orderBy: { createdAt: 'asc' } },
  reviewedBy: { select: { name: true } },
} satisfies Prisma.OrderAdditionRequestInclude;

type AdditionRequestRecord = Prisma.OrderAdditionRequestGetPayload<{ include: typeof additionRequestViewInclude }>;

export function toAdditionRequestView(request: AdditionRequestRecord): AdditionRequestView {
  return {
    ...toOrderTotals(request),
    id: request.id,
    status: request.status,
    rejectionReason: request.rejectionReason,
    submittedAt: request.submittedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewedByName: request.reviewedBy?.name ?? null,
    lines: request.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
    })),
  };
}

type Presentation = { label: string; actionLabel: string; tone: 'warning' | 'success' | 'danger' | 'neutral' };

const presentations: Record<OrderAdditionRequestStatus, Presentation> = {
  DRAFT: { label: 'טיוטה', actionLabel: 'המשך עריכת התוספת', tone: 'warning' },
  PENDING: { label: 'ממתינה לאישור', actionLabel: 'עריכת בקשת התוספת', tone: 'warning' },
  APPROVED: { label: 'אושרה ונוספה להזמנה', actionLabel: 'הוספת פריטים נוספים', tone: 'success' },
  REJECTED: { label: 'נדחתה', actionLabel: 'יצירת בקשה חדשה', tone: 'danger' },
  CANCELLED: { label: 'בוטלה', actionLabel: 'יצירת בקשה חדשה', tone: 'neutral' },
};

export function getAdditionRequestPresentation(status: OrderAdditionRequestStatus): Presentation {
  return presentations[status];
}

export function isAdditionEditable(status: OrderAdditionRequestStatus): boolean {
  return status === 'DRAFT' || status === 'PENDING';
}
