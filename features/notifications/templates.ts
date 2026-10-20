import { formatDate, formatShortDateTime, formatWeekdayDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { formatOrderNumber, type OrderStatus } from '../orders/status';
import type { NotificationTemplateKey } from './config';
import type { WhatsAppTemplateBodyParameter } from './sender';

/** One logical message rendered for every channel. */
export type NotificationContent = {
  templateKey: NotificationTemplateKey;
  subject: string;
  text: string;
  whatsappParameters: WhatsAppTemplateBodyParameter[];
};

type CustomerContext = { id: string; name: string; contact: string };

const SIGNATURE = "\n\nתודה,\nצוות ליבני'ס";

export function getTemplateKeyForOrderStatus(status: OrderStatus): NotificationTemplateKey | null {
  const map: Partial<Record<OrderStatus, NotificationTemplateKey>> = {
    SUBMITTED: 'ORDER_RECEIVED',
    SPECIAL_REQUEST: 'ORDER_SPECIAL_REQUEST',
    APPROVED: 'ORDER_APPROVED',
    PACKED: 'ORDER_PACKED',
    DELIVERED: 'ORDER_DELIVERED',
    CANCELLED: 'ORDER_CANCELLED',
  };
  return map[status] ?? null;
}

const orderStatusSentences: Record<string, { subject: string; body: string }> = {
  ORDER_RECEIVED: { subject: 'קיבלנו את הזמנה', body: 'קיבלנו את ההזמנה והיא ממתינה לאישור הצוות.' },
  ORDER_SPECIAL_REQUEST: {
    subject: 'קיבלנו את הזמנה (בקשה מיוחדת)',
    body: 'ההזמנה התקבלה אחרי מועד סגירת ההזמנות ולכן תטופל כבקשה מיוחדת. נעדכן אם נוכל לספק אותה במועד.',
  },
  ORDER_APPROVED: { subject: 'הזמנה אושרה', body: 'ההזמנה אושרה ונכנסה להכנה.' },
  ORDER_PACKED: { subject: 'הזמנה נארזה', body: 'ההזמנה נארזה ומוכנה ליציאה לחלוקה.' },
  ORDER_DELIVERED: { subject: 'הזמנה סופקה', body: 'ההזמנה סומנה כסופקה. תודה שהזמנתם!' },
  ORDER_CANCELLED: { subject: 'הזמנה בוטלה', body: 'ההזמנה בוטלה. לשאלות ניתן לחזור אלינו בתשובה למייל זה.' },
};

export function buildOrderStatusContent({
  templateKey,
  baseUrl,
  customer,
  order,
}: {
  templateKey: NotificationTemplateKey;
  baseUrl: string;
  customer: CustomerContext;
  order: { orderNumber: number; totalIncludingVat: number; deliveryWindowStart: Date };
}): NotificationContent {
  const orderNumber = formatOrderNumber(order.orderNumber);
  const deliveryDate = formatDate(order.deliveryWindowStart);
  const total = formatMoney(order.totalIncludingVat);
  const link = `${baseUrl}/customer/${customer.id}/orders/${order.orderNumber}`;
  const sentence = orderStatusSentences[templateKey] ?? { subject: 'עדכון להזמנה', body: 'יש עדכון בהזמנה.' };

  return {
    templateKey,
    subject: `${sentence.subject} ${orderNumber} – ליבני'ס`,
    text: [
      `שלום ${customer.contact},`,
      '',
      `${sentence.body}`,
      `הזמנה: ${orderNumber} (${customer.name})`,
      `מועד חלוקה: ${deliveryDate}`,
      `סה״כ כולל מע״מ: ${total}`,
      '',
      `לצפייה בהזמנה: ${link}`,
    ].join('\n') + SIGNATURE,
    // Parameter names must match the templates approved in Meta.
    whatsappParameters: templateKey === 'ORDER_RECEIVED'
      ? [
          { name: 'customer_name', text: customer.contact },
          { name: 'order_id', text: orderNumber },
          { name: 'delivery_date', text: deliveryDate },
        ]
      : [
          { name: 'customer_name', text: customer.contact },
          { name: 'business_name', text: customer.name },
          { name: 'order_id', text: orderNumber },
          { name: 'delivery_date', text: deliveryDate },
          { name: 'order_total', text: total },
          { name: 'order_link', text: link },
        ],
  };
}

export function buildReminderContent({
  baseUrl,
  customer,
  routeName,
  deliveryAt,
  cutoffAt,
}: {
  baseUrl: string;
  customer: CustomerContext;
  routeName: string;
  deliveryAt: Date;
  cutoffAt: Date;
}): NotificationContent {
  const link = `${baseUrl}/customer/${customer.id}`;
  const cutoff = formatShortDateTime(cutoffAt);

  return {
    templateKey: 'ORDER_REMINDER',
    subject: `תזכורת: הזמנה לחלוקה ב${formatWeekdayDate(deliveryAt)} – ליבני'ס`,
    text: [
      `שלום ${customer.contact},`,
      '',
      `החלוקה הבאה של קו ${routeName} ל${customer.name} היא ב${formatWeekdayDate(deliveryAt)}.`,
      `ההזמנות נסגרות ב-${cutoff}.`,
      'ההזמנה הקודמת שלכם כבר מחכה בסל – אפשר לעדכן כמויות ולשלוח בכמה לחיצות:',
      link,
    ].join('\n') + SIGNATURE,
    whatsappParameters: [
      { name: 'customer_name', text: customer.contact },
      { name: 'business_name', text: customer.name },
      { name: 'route_name', text: routeName },
      { name: 'delivery_date', text: formatDate(deliveryAt) },
      { name: 'cutoff_datetime', text: cutoff },
      { name: 'order_link', text: link },
    ],
  };
}

export function buildAdditionDecisionContent({
  baseUrl,
  customer,
  orderNumber,
  decision,
  rejectionReason,
}: {
  baseUrl: string;
  customer: CustomerContext;
  orderNumber: number;
  decision: 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
}): NotificationContent {
  const label = formatOrderNumber(orderNumber);
  const link = `${baseUrl}/customer/${customer.id}/orders/${orderNumber}`;
  const approved = decision === 'APPROVED';
  const reason = rejectionReason || 'לא צוינה סיבה';

  return {
    templateKey: approved ? 'ORDER_ADDITION_APPROVED' : 'ORDER_ADDITION_REJECTED',
    subject: `עדכון בקשת תוספת להזמנה ${label} – ליבני'ס`,
    text: [
      `שלום ${customer.contact},`,
      '',
      approved
        ? `בקשת התוספת להזמנה ${label} אושרה והפריטים נוספו להזמנה.`
        : `בקשת התוספת להזמנה ${label} לא אושרה. סיבה: ${reason}.`,
      '',
      `לצפייה בהזמנה: ${link}`,
    ].join('\n') + SIGNATURE,
    whatsappParameters: approved ? [customer.contact, label] : [customer.contact, label, reason],
  };
}
