import type { OrderStatus } from '@prisma/client';
import { SafeActionError } from '../../lib/safe-action-error';

const additionAllowedStatuses: OrderStatus[] = ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED'];

export function assertAdditionAllowed(status: OrderStatus): void {
  if (!additionAllowedStatuses.includes(status)) {
    throw new SafeActionError('ORDER_LOCKED', 'לא ניתן להוסיף פריטים להזמנה בשלב זה.');
  }
}

export function assertOrderCanBePacked(pendingAdditionCount: number): void {
  if (pendingAdditionCount > 0) {
    throw new SafeActionError('ORDER_LOCKED', 'יש לאשר או לדחות את בקשת התוספת לפני אריזת ההזמנה.');
  }
}
