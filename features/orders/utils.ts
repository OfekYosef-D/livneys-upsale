import { SafeActionError } from '../../lib/safe-action-error';

export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SPECIAL_REQUEST'
  | 'APPROVED'
  | 'PACKED'
  | 'DELIVERED'
  | 'CANCELLED';

export const orderStatusValues = ['DRAFT', 'SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED', 'DELIVERED', 'CANCELLED'] as const;

export const orderStatusLabels: Record<OrderStatus, string> = {
  DRAFT: 'טיוטה',
  SUBMITTED: 'התקבל',
  SPECIAL_REQUEST: 'בקשה מיוחדת',
  APPROVED: 'מאושר',
  PACKED: 'ארוז',
  DELIVERED: 'סופק',
  CANCELLED: 'בוטל',
};

export const activeOrderStatuses: OrderStatus[] = ['SUBMITTED', 'SPECIAL_REQUEST', 'APPROVED', 'PACKED'];

export type SnapshotProduct = {
  id: string;
  name: string;
  price: number;
  minQty?: number;
  orderMultiple?: number;
};

export type SnapshotItem = {
  productId: string;
  quantity: number;
};

export type OrderSnapshotLine = {
  productId: string;
  productName: string;
  quantity: number;
  listUnitPrice: number;
  unitPrice: number;
  lineSubtotal: number;
  discountTotal: number;
  lineTotal: number;
  promotionId: string | null;
  promotionSnapshot: {
    id: string;
    title: string;
    tag: string;
    description: string;
    effectType: string;
  } | null;
};

export function normalizeCustomerOrderItems(
  items: Array<{ productId: string; qty?: number; quantity?: number }>,
  activeProducts: Array<{ id: string; minQty?: number; orderMultiple?: number; name: string }>,
): SnapshotItem[] {
  const productsById = new Map(activeProducts.map((product) => [product.id, product]));
  const normalized: SnapshotItem[] = [];

  for (const item of items) {
    const quantity = Math.floor(item.qty ?? item.quantity ?? 0);
    if (quantity <= 0) continue;

    const product = productsById.get(item.productId);
    if (!product) continue;

    const minQty = product.minQty ?? 1;
    if (quantity < minQty) {
      throw new SafeActionError('VALIDATION_ERROR', `הכמות המינימלית עבור ${product.name} היא ${minQty}.`);
    }

    const orderMultiple = Math.max(1, Math.floor(product.orderMultiple ?? 1));
    if (orderMultiple > 1 && quantity % orderMultiple !== 0) {
      throw new SafeActionError('VALIDATION_ERROR', `הכמות עבור ${product.name} חייבת להיות בכפולות של ${orderMultiple}.`);
    }

    normalized.push({ productId: item.productId, quantity });
  }

  return normalized;
}

export function createOrderSnapshotLines({
  items,
  products,
}: {
  items: SnapshotItem[];
  products: SnapshotProduct[];
}): OrderSnapshotLine[] {
  return items
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);

      if (!product) {
        throw new SafeActionError('NOT_FOUND', 'המוצר המבוקש אינו זמין להזמנה.');
      }

      const quantity = Math.floor(item.quantity);
      const minQty = product.minQty ?? 1;

      if (quantity < minQty) {
        throw new SafeActionError('VALIDATION_ERROR', `הכמות המינימלית עבור ${product.name} היא ${minQty}.`);
      }

      const orderMultiple = Math.max(1, Math.floor(product.orderMultiple ?? 1));
      if (orderMultiple > 1 && quantity % orderMultiple !== 0) {
        throw new SafeActionError('VALIDATION_ERROR', `הכמות עבור ${product.name} חייבת להיות בכפולות של ${orderMultiple}.`);
      }

      const unitPrice = product.price;

      return {
        productId: product.id,
        productName: product.name,
        quantity,
        listUnitPrice: unitPrice,
        unitPrice,
        lineSubtotal: unitPrice * quantity,
        discountTotal: 0,
        lineTotal: unitPrice * quantity,
        promotionId: null,
        promotionSnapshot: null,
      };
    });
}

export function getSubmissionStatus({ now, cutoff }: { now: Date; cutoff: Date }): OrderStatus {
  return now.getTime() > cutoff.getTime() ? 'SPECIAL_REQUEST' : 'SUBMITTED';
}

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
    throw new SafeActionError('ORDER_LOCKED', 'לא ניתן להעביר את ההזמנה לסטטוס המבוקש.');
  }

  return next;
}
