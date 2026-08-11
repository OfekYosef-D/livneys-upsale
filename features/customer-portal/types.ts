import type { PaymentTermValue } from '../orders/payment-terms';

export type PortalCustomer = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  region: string;
  address: string;
  notes?: string | null;
};

export type PortalRoute = {
  id: string;
  name: string;
  nextDelivery: string;
  deadline: string;
  opsContactName?: string | null;
  opsContactPhone?: string | null;
};

export type PortalProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  listPrice: number;
  price: number;
  unit: string;
  caseSize: string;
  minQty: number;
  orderMultiple: number;
  assetImage?: string | null;
  imageUrl?: string | null;
  stockLabel?: string | null;
  description?: string | null;
  recommended?: boolean;
  isRecommended?: boolean;
  isPreviousOrder?: boolean;
  promoLabel?: string;
  promotion?: {
    id: string;
    title: string;
    tag: string;
    description: string;
    effectType: 'DISPLAY_ONLY' | 'PERCENT_OFF' | 'FIXED_AMOUNT_OFF' | 'FIXED_UNIT_PRICE' | 'BUY_X_GET_Y';
    discountValue: number | null;
    buyQuantity: number | null;
    freeQuantity: number | null;
  } | null;
};

export type PortalOrder = {
  id: string;
  orderNumber: number | null;
  customerId: string;
  date: string;
  status: string;
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
  items: {
    productId: string;
    productName?: string;
    qty: number;
    listUnitPrice?: number;
    unitPrice?: number;
    lineSubtotal?: number;
    discountTotal?: number;
    lineTotal?: number;
    promotionLabel?: string;
  }[];
};

export type CustomerPortalData = {
  customer: PortalCustomer;
  route: PortalRoute;
  products: PortalProduct[];
  lastOrder: PortalOrder;
  activeOrderForDelivery: { id: string; orderNumber: number } | null;
};
