import { describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { buildAdditionDecisionContent, buildOrderStatusContent, buildReminderContent, getTemplateKeyForOrderStatus } from './templates';

const baseUrl = 'https://orders.example.com';
const customer = { id: 'cust-001', name: 'קפה דרום', contact: 'דנה' };
const deliveryWindowStart = new Date('2026-07-02T05:00:00.000Z');
const order = { orderNumber: 1042, totalIncludingVat: 1234.5, deliveryWindowStart };

function parameterNames(parameters: unknown[]) {
  return parameters.map((parameter) => (parameter as { name: string }).name);
}

describe('getTemplateKeyForOrderStatus', () => {
  it.each([
    ['SUBMITTED', 'ORDER_RECEIVED'],
    ['SPECIAL_REQUEST', 'ORDER_SPECIAL_REQUEST'],
    ['APPROVED', 'ORDER_APPROVED'],
    ['PACKED', 'ORDER_PACKED'],
    ['DELIVERED', 'ORDER_DELIVERED'],
    ['CANCELLED', 'ORDER_CANCELLED'],
  ] as const)('maps %s to %s', (status, key) => {
    expect(getTemplateKeyForOrderStatus(status)).toBe(key);
  });

  it('does not notify for draft orders', () => {
    expect(getTemplateKeyForOrderStatus('DRAFT' as never)).toBeNull();
  });
});

describe('buildOrderStatusContent', () => {
  it('renders a Hebrew email with order number, date, total and link', () => {
    const content = buildOrderStatusContent({ templateKey: 'ORDER_APPROVED', baseUrl, customer, order });

    expect(content.templateKey).toBe('ORDER_APPROVED');
    expect(content.subject).toContain('הזמנה אושרה');
    expect(content.subject).toContain('#1042');
    expect(content.text).toContain('שלום דנה,');
    expect(content.text).toContain('#1042 (קפה דרום)');
    expect(content.text).toContain(formatDate(deliveryWindowStart));
    expect(content.text).toContain(formatMoney(1234.5));
    expect(content.text).toContain('https://orders.example.com/customer/cust-001/orders/1042');
  });

  it('uses the three approved parameters for ORDER_RECEIVED', () => {
    const content = buildOrderStatusContent({ templateKey: 'ORDER_RECEIVED', baseUrl, customer, order });
    expect(content.whatsappParameters).toEqual([
      { name: 'customer_name', text: 'דנה' },
      { name: 'order_id', text: '#1042' },
      { name: 'delivery_date', text: formatDate(deliveryWindowStart) },
    ]);
  });

  it('uses six named parameters for other lifecycle statuses', () => {
    const content = buildOrderStatusContent({ templateKey: 'ORDER_PACKED', baseUrl, customer, order });
    expect(parameterNames(content.whatsappParameters)).toEqual([
      'customer_name', 'business_name', 'order_id', 'delivery_date', 'order_total', 'order_link',
    ]);
    expect(content.whatsappParameters).toContainEqual({ name: 'order_link', text: 'https://orders.example.com/customer/cust-001/orders/1042' });
    expect(content.whatsappParameters).toContainEqual({ name: 'business_name', text: 'קפה דרום' });
  });
});

describe('buildReminderContent', () => {
  it('renders the reminder with route, cutoff and link and six named parameters', () => {
    const deliveryAt = new Date('2026-07-02T05:00:00.000Z');
    const cutoffAt = new Date('2026-06-30T15:00:00.000Z');
    const content = buildReminderContent({ baseUrl, customer, routeName: 'דרום', deliveryAt, cutoffAt });

    expect(content.templateKey).toBe('ORDER_REMINDER');
    expect(content.subject).toContain('תזכורת');
    expect(content.text).toContain('קו דרום');
    expect(content.text).toContain('https://orders.example.com/customer/cust-001');
    expect(parameterNames(content.whatsappParameters)).toEqual([
      'customer_name', 'business_name', 'route_name', 'delivery_date', 'cutoff_datetime', 'order_link',
    ]);
    expect(content.whatsappParameters).toContainEqual({ name: 'delivery_date', text: formatDate(deliveryAt) });
  });
});

describe('buildAdditionDecisionContent', () => {
  it('builds the approved message', () => {
    const content = buildAdditionDecisionContent({ baseUrl, customer, orderNumber: 1042, decision: 'APPROVED', rejectionReason: null });
    expect(content.templateKey).toBe('ORDER_ADDITION_APPROVED');
    expect(content.text).toContain('אושרה');
    expect(content.text).toContain('https://orders.example.com/customer/cust-001/orders/1042');
    expect(content.whatsappParameters).toEqual(['דנה', '#1042']);
  });

  it('builds the rejected message with the reason, or a default reason', () => {
    const withReason = buildAdditionDecisionContent({ baseUrl, customer, orderNumber: 1042, decision: 'REJECTED', rejectionReason: 'המלאי אזל' });
    expect(withReason.templateKey).toBe('ORDER_ADDITION_REJECTED');
    expect(withReason.text).toContain('סיבה: המלאי אזל');
    expect(withReason.whatsappParameters).toEqual(['דנה', '#1042', 'המלאי אזל']);

    const withoutReason = buildAdditionDecisionContent({ baseUrl, customer, orderNumber: 1042, decision: 'REJECTED', rejectionReason: '' });
    expect(withoutReason.whatsappParameters[2]).toBe('לא צוינה סיבה');
  });
});
