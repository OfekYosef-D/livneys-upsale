import type { OrderAdditionRequestStatus } from '@prisma/client';
import type { CatalogProduct } from '../catalog/customer-catalog';
import type { OrderTotals } from '../orders/totals';
import type { OrderView } from '../orders/view-model';

export type PortalCustomer = {
  id: string;
  name: string;
  contact: string;
};

export type PortalSchedule = {
  routeName: string;
  deliveryAt: string;
  cutoffAt: string;
  isPastCutoff: boolean;
  opsContactName: string | null;
  opsContactPhone: string | null;
};

export type PortalProduct = CatalogProduct & {
  isRecommended: boolean;
  isPreviousOrder: boolean;
};

/** Where the initial cart comes from: this week's saved draft, or a re-order of the last order. */
export type CartSeed = {
  source: 'DRAFT' | 'PREVIOUS_ORDER' | 'EMPTY';
  orderNumber: number | null;
  lines: Array<{ productId: string | null; quantity: number }>;
};

export type CustomerPortalData = {
  customer: PortalCustomer;
  schedule: PortalSchedule;
  products: PortalProduct[];
  vatRatePercent: number;
  cartSeed: CartSeed;
  /** The order already placed for the upcoming delivery, if any. */
  activeOrder: { id: string; orderNumber: number } | null;
};

export type AdditionRequestView = OrderTotals & {
  id: string;
  status: OrderAdditionRequestStatus;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  lines: Array<{ id: string; productId: string | null; productName: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

export type CustomerOrderDetail = {
  order: OrderView;
  canAddItems: boolean;
  latestAddition: AdditionRequestView | null;
};
