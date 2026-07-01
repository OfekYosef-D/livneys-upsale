import type { OrderStatus } from '@/features/orders/utils';
import type { WhatsAppTemplateKey } from './config';
import type { WhatsAppTemplateBodyParameter } from './sender';

type TemplatePayload = {
  languageCode: 'he';
  bodyParameters: WhatsAppTemplateBodyParameter[];
  previewMessage: string;
};

type CustomerTemplateContext = {
  id: string;
  name: string;
  contact: string;
};

export function getTemplateKeyForOrderStatus(status: OrderStatus): WhatsAppTemplateKey | null {
  switch (status) {
    case 'SUBMITTED':
      return 'ORDER_RECEIVED';
    case 'SPECIAL_REQUEST':
      return 'ORDER_SPECIAL_REQUEST';
    case 'APPROVED':
      return 'ORDER_APPROVED';
    case 'PACKED':
      return 'ORDER_PACKED';
    case 'DELIVERED':
      return 'ORDER_DELIVERED';
    case 'CANCELLED':
      return 'ORDER_CANCELLED';
    case 'DRAFT':
      return null;
  }
}

export function buildOrderTemplatePayload({
  templateKey,
  baseUrl,
  customer,
  order,
}: {
  templateKey: WhatsAppTemplateKey;
  baseUrl: string;
  customer: CustomerTemplateContext;
  order: {
    id: string;
    status: OrderStatus;
    total: number;
    deliveryWindowStart: Date;
  };
}): TemplatePayload {
  const customerUrl = buildCustomerUrl(baseUrl, customer.id);
  const deliveryDate = formatDate(order.deliveryWindowStart);
  const total = formatCurrency(order.total);

  if (templateKey === 'ORDER_RECEIVED') {
    return {
      languageCode: 'he',
      bodyParameters: [
        { name: 'customer_name', text: customer.contact },
        { name: 'order_id', text: order.id },
        { name: 'delivery_date', text: deliveryDate },
      ],
      previewMessage: `${customer.name}: ${templateKey} ${order.id} ${deliveryDate} ${total}`,
    };
  }

  return {
    languageCode: 'he',
    bodyParameters: [
      { name: 'customer_name', text: customer.contact },
      { name: 'business_name', text: customer.name },
      { name: 'order_id', text: order.id },
      { name: 'delivery_date', text: deliveryDate },
      { name: 'order_total', text: total },
      { name: 'order_link', text: customerUrl },
    ],
    previewMessage: `${customer.name}: ${templateKey} ${order.id} ${deliveryDate} ${total}`,
  };
}

export function buildReminderTemplatePayload({
  baseUrl,
  customer,
  route,
}: {
  baseUrl: string;
  customer: CustomerTemplateContext;
  route: {
    name: string;
    nextDeliveryAt: Date;
    nextCutoffAt: Date;
  };
}): TemplatePayload {
  const customerUrl = buildCustomerUrl(baseUrl, customer.id);
  const deliveryDate = formatDate(route.nextDeliveryAt);
  const cutoff = formatDateTime(route.nextCutoffAt);

  return {
    languageCode: 'he',
    bodyParameters: [
      { name: 'customer_name', text: customer.contact },
      { name: 'business_name', text: customer.name },
      { name: 'route_name', text: route.name },
      { name: 'delivery_date', text: deliveryDate },
      { name: 'cutoff_datetime', text: cutoff },
      { name: 'order_link', text: customerUrl },
    ],
    previewMessage: `${customer.name}: תזכורת להזמנה לקו ${route.name}, חלוקה ${deliveryDate}`,
  };
}

function buildCustomerUrl(baseUrl: string, customerId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/customer/${customerId}`;
}

function formatDate(value: Date): string {
  const parts = getDateParts(value);
  return `${parts.day}/${parts.month}/${parts.year}`;
}

function formatDateTime(value: Date): string {
  const parts = getDateParts(value);
  const time = new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem',
  }).format(value);
  return `${parts.day}/${parts.month}/${parts.year}, ${time}`;
}

function formatCurrency(value: number): string {
  return `₪${value.toFixed(2)}`;
}

function getDateParts(value: Date): { day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).formatToParts(value);

  return {
    day: parts.find((part) => part.type === 'day')?.value ?? '01',
    month: parts.find((part) => part.type === 'month')?.value ?? '01',
    year: parts.find((part) => part.type === 'year')?.value ?? '1970',
  };
}
