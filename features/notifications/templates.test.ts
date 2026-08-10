import { describe, expect, it } from 'vitest';
import {
  buildOrderTemplatePayload,
  buildReminderTemplatePayload,
  getTemplateKeyForOrderStatus,
} from './templates';

describe('notification templates', () => {
  it('maps order statuses to lifecycle WhatsApp template keys', () => {
    expect(getTemplateKeyForOrderStatus('SUBMITTED')).toBe('ORDER_RECEIVED');
    expect(getTemplateKeyForOrderStatus('SPECIAL_REQUEST')).toBe('ORDER_SPECIAL_REQUEST');
    expect(getTemplateKeyForOrderStatus('APPROVED')).toBe('ORDER_APPROVED');
    expect(getTemplateKeyForOrderStatus('PACKED')).toBe('ORDER_PACKED');
    expect(getTemplateKeyForOrderStatus('DELIVERED')).toBe('ORDER_DELIVERED');
    expect(getTemplateKeyForOrderStatus('CANCELLED')).toBe('ORDER_CANCELLED');
    expect(getTemplateKeyForOrderStatus('DRAFT')).toBeNull();
  });

  it('builds named order received variables for approved Meta templates', () => {
    const payload = buildOrderTemplatePayload({
      templateKey: 'ORDER_RECEIVED',
      baseUrl: 'https://orders.example.com',
      customer: { id: 'cust-001', name: 'Cafe South', contact: 'Dana' },
      order: {
        orderNumber: 1001,
        status: 'SUBMITTED',
        totalIncludingVat: 145.73,
        deliveryWindowStart: new Date('2026-07-01T08:00:00.000Z'),
      },
    });

    expect(payload.bodyParameters).toEqual([
      { name: 'customer_name', text: 'Dana' },
      { name: 'order_id', text: '#1001' },
      { name: 'delivery_date', text: '01/07/2026' },
    ]);
    expect(payload.previewMessage).toContain('Cafe South');
    expect(payload.previewMessage).toContain('#1001');
    expect(payload.previewMessage).not.toContain('ord-1');
  });

  it('builds extended order lifecycle variables for non-received statuses', () => {
    const payload = buildOrderTemplatePayload({
      templateKey: 'ORDER_APPROVED',
      baseUrl: 'https://orders.example.com',
      customer: { id: 'cust-001', name: 'Cafe South', contact: 'Dana' },
      order: {
        orderNumber: 1001,
        status: 'APPROVED',
        totalIncludingVat: 145.73,
        deliveryWindowStart: new Date('2026-07-01T08:00:00.000Z'),
      },
    });

    expect(payload.bodyParameters).toEqual([
      { name: 'customer_name', text: 'Dana' },
      { name: 'business_name', text: 'Cafe South' },
      { name: 'order_id', text: '#1001' },
      { name: 'delivery_date', text: '01/07/2026' },
      { name: 'order_total', text: '₪145.73' },
      { name: 'order_link', text: 'https://orders.example.com/customer/cust-001' },
    ]);
  });

  it('builds reminder template variables for route cutoffs', () => {
    const payload = buildReminderTemplatePayload({
      baseUrl: 'https://orders.example.com',
      customer: { id: 'cust-001', name: 'Cafe South', contact: 'Dana' },
      route: {
        name: 'South',
        nextDeliveryAt: new Date('2026-07-01T08:00:00.000Z'),
        nextCutoffAt: new Date('2026-06-30T15:00:00.000Z'),
      },
    });

    expect(payload.bodyParameters).toEqual([
      { name: 'customer_name', text: 'Dana' },
      { name: 'business_name', text: 'Cafe South' },
      { name: 'route_name', text: 'South' },
      { name: 'delivery_date', text: '01/07/2026' },
      { name: 'cutoff_datetime', text: '30/06/2026, 18:00' },
      { name: 'order_link', text: 'https://orders.example.com/customer/cust-001' },
    ]);
  });
});
