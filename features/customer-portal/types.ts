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
  price: number;
  unit: string;
  caseSize: string;
  minQty: number;
  assetImage?: string | null;
  imageUrl?: string | null;
  stockLabel?: string | null;
  description?: string | null;
  recommended?: boolean;
  isRecommended?: boolean;
  isPreviousOrder?: boolean;
  promoLabel?: string;
};

export type PortalOrder = {
  id: string;
  customerId: string;
  date: string;
  status: string;
  items: { productId: string; qty: number }[];
};

export type CustomerPortalData = {
  customer: PortalCustomer;
  route: PortalRoute;
  products: PortalProduct[];
  lastOrder: PortalOrder;
};
