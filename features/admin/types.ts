import type { OrderStatus } from '@/features/orders/utils';

export type AdminOrderLine = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type AdminOrderSummary = {
  id: string;
  customerId: string;
  customerName: string;
  routeId: string | null;
  routeName: string;
  status: OrderStatus;
  submittedAt: string | null;
  deliveryWindowStart: string;
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
