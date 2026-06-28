import type { OrderStatus } from '@/features/orders/utils';

export type AdminOrderSource = 'CUSTOMER' | 'ADMIN';

export type AdminOrderLine = {
  id: string;
  productName: string;
  quantity: number;
  listUnitPrice: number;
  unitPrice: number;
  lineSubtotal: number;
  discountTotal: number;
  lineTotal: number;
  promotionLabel?: string;
};

export type AdminOrderSummary = {
  id: string;
  customerId: string;
  customerName: string;
  routeId: string | null;
  routeName: string;
  status: OrderStatus;
  source: AdminOrderSource;
  submittedAt: string | null;
  deliveryWindowStart: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  lineCount: number;
  hasUpsell: boolean;
};

export type AdminRouteSummary = {
  id: string;
  name: string;
  nextDeliveryAt: string;
  nextCutoffAt: string;
  customerCount: number;
  orderedCount: number;
  missingCount: number;
};
