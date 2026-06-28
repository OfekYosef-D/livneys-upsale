export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SPECIAL_REQUEST'
  | 'APPROVED'
  | 'PACKED'
  | 'DELIVERED'
  | 'CANCELLED';

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
        throw new Error(`Unknown product ${item.productId}`);
      }

      const quantity = Math.floor(item.quantity);
      const minQty = product.minQty ?? 1;

      if (quantity < minQty) {
        throw new Error(`Minimum quantity for ${product.name} is ${minQty}`);
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

export function assertOrderStatusTransition(current: OrderStatus, next: OrderStatus): OrderStatus {
  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Invalid order status transition: ${current} -> ${next}`);
  }

  return next;
}
