import type { OrderStatus } from '@prisma/client';
import { AppError } from '@/lib/errors';

export type { OrderStatus };

export const orderStatusValues = [
  'DRAFT',
  'SUBMITTED',
  'SPECIAL_REQUEST',
  'APPROVED',
  'PACKED',
  'DELIVERED',
  'CANCELLED',
] as const satisfies readonly OrderStatus[];

export const orderStatusLabels: Record<OrderStatus, string> = {
  DRAFT: 'טיוטה',
  SUBMITTED: 'התקבלה',
  SPECIAL_REQUEST: 'בקשה מיוחדת',
  APPROVED: 'מאושרת',
  PACKED: 'ארוזה',
  DELIVERED: 'סופקה',
  CANCELLED: 'בוטלה',
};

/** Orders the team still has to handle for the current delivery. */
export const openOrderStatuses: OrderStatus[] = ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED'];

/** Orders the customer has sent (anything past draft). */
export const placedOrderStatuses: OrderStatus[] = ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED', 'DELIVERED', 'CANCELLED'];

/** A customer may request additional items until the order is packed. */
export const additionAllowedStatuses: OrderStatus[] = ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED'];

export function canAddItems(status: OrderStatus): boolean {
  return additionAllowedStatuses.includes(status);
}

/** State machine for the admin order workflow. */
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['SUBMITTED', 'SPECIAL_REQUEST', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'CANCELLED'],
  SPECIAL_REQUEST: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PACKED', 'CANCELLED'],
  PACKED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function getAllowedOrderStatusTransitions(current: OrderStatus): OrderStatus[] {
  return [...allowedTransitions[current]];
}

export function assertOrderStatusTransition(current: OrderStatus, next: OrderStatus): OrderStatus {
  if (!allowedTransitions[current].includes(next)) {
    throw new AppError('ORDER_LOCKED', 'לא ניתן להעביר את ההזמנה לסטטוס המבוקש.');
  }
  return next;
}

/** Orders sent after the route cut-off need the owner's approval as a special request. */
export function getSubmissionStatus({ now, cutoff }: { now: Date; cutoff: Date }): OrderStatus {
  return now.getTime() > cutoff.getTime() ? 'SPECIAL_REQUEST' : 'SUBMITTED';
}

export function formatOrderNumber(orderNumber: number): string {
  return `#${orderNumber}`;
}

/** Order numbers arrive from URLs; anything that is not a positive integer is rejected. */
export function parseOrderNumber(value: string): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
