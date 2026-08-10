import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as actions from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/features/orders/service', () => ({
  createSubmittedOrder: vi.fn(),
  getOrderWriteContext: vi.fn(),
}));

vi.mock('@/features/pricing/engine', () => ({
  calculateOrderPricing: vi.fn(),
}));

vi.mock('../notifications/jobs', () => ({
  enqueueOrderLifecycleWhatsApp: vi.fn(),
}));

vi.mock('@/lib/action-result', () => ({
  actionOk: (data: unknown) => ({ ok: true, data }),
  actionError: (error: unknown) => ({
    ok: false,
    error: error instanceof Error ? error.message : 'Unexpected error',
  }),
}));

vi.mock('@/lib/authorization', () => ({
  assertCustomerAction: vi.fn(),
}));

const { assertCustomerAction } = await import('@/lib/authorization');
const { createSubmittedOrder, getOrderWriteContext } = await import('@/features/orders/service');
const { enqueueOrderLifecycleWhatsApp } = await import('../notifications/jobs');

const mockedAssertCustomerAction = vi.mocked(assertCustomerAction);
const mockedCreateSubmittedOrder = vi.mocked(createSubmittedOrder);
const mockedGetOrderWriteContext = vi.mocked(getOrderWriteContext);
const mockedEnqueueOrderLifecycleWhatsApp = vi.mocked(enqueueOrderLifecycleWhatsApp);

describe('customer portal actions', () => {
  beforeEach(() => {
    mockedAssertCustomerAction.mockReset();
    mockedCreateSubmittedOrder.mockReset();
    mockedGetOrderWriteContext.mockReset();
    mockedEnqueueOrderLifecycleWhatsApp.mockReset();
  });

  it('queues lifecycle WhatsApp notifications after customer order submission', async () => {
    mockedAssertCustomerAction.mockResolvedValue({
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-001' },
      expires: '2026-07-01T00:00:00.000Z',
    });
    mockedCreateSubmittedOrder.mockResolvedValue({
      orderId: 'ord-customer',
      status: 'SUBMITTED',
      routeId: 'route-south',
    });
    mockedGetOrderWriteContext.mockResolvedValue({
      customer: {
        id: 'cust-001',
        routeId: 'route-south',
        priceListId: 'price-list-standard',
        isActive: true,
      },
      route: {
        id: 'route-south',
        isActive: true,
        nextDeliveryAt: new Date('2026-07-10T08:00:00.000Z'),
        nextCutoffAt: new Date('2026-07-09T15:00:00.000Z'),
      },
      products: [
        {
          id: 'prod-a',
          name: 'Product A',
          category: 'Spreads',
          basePrice: 100,
          isActive: true,
          minQty: 1,
          orderMultiple: 1,
        },
      ],
      priceListItems: [{ productId: 'prod-a', price: 100 }],
      promotions: [],
    });

    const result = await actions.submitCustomerOrderAction({
      customerId: 'cust-001',
      items: [{ productId: 'prod-a', qty: 2 }],
      notes: 'Call before arrival',
      paymentTerm: 'IMMEDIATE_OR_CASH',
    });

    expect(result).toEqual({
      ok: true,
      data: { orderId: 'ord-customer', status: 'SUBMITTED' },
    });
    expect(mockedCreateSubmittedOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentTerm: 'IMMEDIATE_OR_CASH' }),
    );
    expect(mockedEnqueueOrderLifecycleWhatsApp).toHaveBeenCalledWith({ orderId: 'ord-customer' });
  });

  it('rejects an unsupported payment term before creating an order', async () => {
    mockedAssertCustomerAction.mockResolvedValue({
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-001' },
      expires: '2026-07-01T00:00:00.000Z',
    });
    mockedCreateSubmittedOrder.mockResolvedValue({
      orderId: 'ord-customer',
      status: 'SUBMITTED',
      routeId: 'route-south',
    });
    mockedGetOrderWriteContext.mockResolvedValue({
      customer: {
        id: 'cust-001',
        routeId: 'route-south',
        priceListId: 'price-list-standard',
        isActive: true,
      },
      route: {
        id: 'route-south',
        isActive: true,
        nextDeliveryAt: new Date('2026-07-10T08:00:00.000Z'),
        nextCutoffAt: new Date('2026-07-09T15:00:00.000Z'),
      },
      products: [
        {
          id: 'prod-a',
          name: 'Product A',
          category: 'Spreads',
          basePrice: 100,
          isActive: true,
          minQty: 1,
          orderMultiple: 1,
        },
      ],
      priceListItems: [{ productId: 'prod-a', price: 100 }],
      promotions: [],
    });

    const result = await actions.submitCustomerOrderAction({
      customerId: 'cust-001',
      items: [{ productId: 'prod-a', qty: 2 }],
      paymentTerm: 'INVALID' as 'NET_30',
    });

    expect(result.ok).toBe(false);
    expect(mockedCreateSubmittedOrder).not.toHaveBeenCalled();
  });
});
