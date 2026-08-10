import type { OrderStatus } from '@/features/orders/utils';
import type { PaymentTermValue } from '@/features/orders/payment-terms';

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

export type AdminOrderNotificationSummary = {
  id: string;
  status: string;
  templateKey: string;
  scheduledAt: string;
  processedAt: string | null;
  errorMessage: string | null;
};

export type AdminOrderSummary = {
  id: string;
  orderNumber: number;
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
  paymentTerm: PaymentTermValue;
  paymentDiscountPercent: number;
  paymentDiscountTotal: number;
  total: number;
  vatRatePercent: number;
  vatTotal: number;
  totalIncludingVat: number;
  commercialTermsVersion: string | null;
  commercialTermsAcceptedAt: string | null;
  lineCount: number;
  hasUpsell: boolean;
};

export type AdminDashboardOrder = AdminOrderSummary & {
  customerContact: string;
  customerPhone: string;
  notes: string | null;
  internalNote: string | null;
  lines: AdminOrderLine[];
  latestNotification: AdminOrderNotificationSummary | null;
};

export type AdminRouteMissingCustomer = {
  id: string;
  name: string;
  contact: string;
  phone: string;
};

export type AdminRouteSummary = {
  id: string;
  name: string;
  nextDeliveryAt: string;
  nextCutoffAt: string;
  customerCount: number;
  orderedCount: number;
  missingCount: number;
  missingCustomers: AdminRouteMissingCustomer[];
};
