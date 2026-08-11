import { describe, expect, it } from 'vitest';
import { getActiveOrderAdminRedirect, getActiveOrderCustomerRedirect, getAdditionRequestPresentation } from './ui';

describe('addition request presentation', () => {
  it('invites editing while a request is pending', () => {
    expect(getAdditionRequestPresentation('PENDING')).toMatchObject({
      label: 'ממתינה לאישור', actionLabel: 'עריכת בקשת התוספת', canStartNew: false,
    });
  });

  it('allows a new request after rejection and keeps the reason visible', () => {
    expect(getAdditionRequestPresentation('REJECTED')).toMatchObject({
      label: 'נדחתה', actionLabel: 'יצירת בקשה חדשה', canStartNew: true,
    });
  });

  it('builds the admin redirect only for an existing-order conflict', () => {
    expect(getActiveOrderAdminRedirect('ACTIVE_ORDER_EXISTS', { orderId: 'order-001' })).toBe('/admin/orders/order-001');
    expect(getActiveOrderAdminRedirect('UNAUTHORIZED', { orderId: 'order-001' })).toBeNull();
  });

  it('builds the customer redirect with the human order number', () => {
    expect(getActiveOrderCustomerRedirect('cust-001', 'ACTIVE_ORDER_EXISTS', { orderNumber: 1042 })).toBe('/customer/cust-001/orders/1042');
    expect(getActiveOrderCustomerRedirect('cust-001', 'ACTIVE_ORDER_EXISTS', { orderId: 'opaque' })).toBeNull();
  });
});
