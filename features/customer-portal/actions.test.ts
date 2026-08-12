import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as actions from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
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

vi.mock('@/features/orders/persistence', () => ({
  cancelDraftOrder: vi.fn(),
  isRetryableOrderWriteError: vi.fn(() => false),
  persistDraftOrder: vi.fn(),
  StaleOrderWriteError: class StaleOrderWriteError extends Error {},
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
const { cancelDraftOrder, persistDraftOrder } = await import('@/features/orders/persistence');
const { calculateOrderPricing } = await import('@/features/pricing/engine');

const mockedAssertCustomerAction = vi.mocked(assertCustomerAction);
const mockedCreateSubmittedOrder = vi.mocked(createSubmittedOrder);
const mockedGetOrderWriteContext = vi.mocked(getOrderWriteContext);
const mockedEnqueueOrderLifecycleWhatsApp = vi.mocked(enqueueOrderLifecycleWhatsApp);
const mockedPersistDraftOrder = vi.mocked(persistDraftOrder);
const mockedCancelDraftOrder = vi.mocked(cancelDraftOrder);
const mockedCalculateOrderPricing = vi.mocked(calculateOrderPricing);
const idempotencyKey = '9d31ee3f-3eb9-4cbc-b0ff-d48ed1daed71';

describe('customer portal actions', () => {
  beforeEach(() => {
    mockedAssertCustomerAction.mockReset();
    mockedCreateSubmittedOrder.mockReset();
    mockedGetOrderWriteContext.mockReset();
    mockedEnqueueOrderLifecycleWhatsApp.mockReset();
    mockedPersistDraftOrder.mockReset();
    mockedCancelDraftOrder.mockReset();
    mockedCalculateOrderPricing.mockReset();
  });

  it('cancels the current draft when the customer empties the cart', async () => {
    mockedAssertCustomerAction.mockResolvedValue({
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-001' },
      expires: '2026-08-12T00:00:00.000Z',
    });
    mockedGetOrderWriteContext.mockResolvedValue({
      customer: { id: 'cust-001', routeId: 'route-south', priceListId: 'price-list-standard', isActive: true },
      route: {
        id: 'route-south', isActive: true,
        nextDeliveryAt: new Date('2026-08-12T08:00:00.000Z'),
        nextCutoffAt: new Date('2026-08-11T15:00:00.000Z'),
      },
      products: [],
      priceListItems: [],
      promotions: [],
    });
    mockedCancelDraftOrder.mockResolvedValue({ orderId: 'draft-empty', cancelled: true });

    const result = await actions.saveDraftOrderAction({ customerId: 'cust-001', items: [] });

    expect(result).toEqual({ ok: true, data: { orderId: null } });
    expect(mockedCancelDraftOrder).toHaveBeenCalledWith(expect.anything(), {
      customerId: 'cust-001',
      deliveryWindowStart: new Date('2026-08-12T08:00:00.000Z'),
    });
    expect(mockedCalculateOrderPricing).not.toHaveBeenCalled();
  });

  it('persists a draft through the transactional order integrity layer', async () => {
    mockedAssertCustomerAction.mockResolvedValue({
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-001' },
      expires: '2026-08-12T00:00:00.000Z',
    });
    mockedGetOrderWriteContext.mockResolvedValue({
      customer: { id: 'cust-001', routeId: 'route-south', priceListId: 'price-list-standard', isActive: true },
      route: {
        id: 'route-south',
        isActive: true,
        nextDeliveryAt: new Date('2026-08-12T08:00:00.000Z'),
        nextCutoffAt: new Date('2026-08-11T15:00:00.000Z'),
      },
      products: [{
        id: 'prod-a', name: 'Product A', category: 'Spreads', basePrice: 100,
        isActive: true, minQty: 1, orderMultiple: 1,
      }],
      priceListItems: [{ productId: 'prod-a', price: 100 }],
      promotions: [],
    });
    mockedCalculateOrderPricing.mockReturnValue({
      subtotal: 200,
      discountTotal: 0,
      total: 200,
      lines: [{
        productId: 'prod-a', productName: 'Product A', quantity: 2,
        listUnitPrice: 100, unitPrice: 100, lineSubtotal: 200,
        discountTotal: 0, lineTotal: 200, promotionId: null, promotionSnapshot: null,
      }],
    });
    mockedPersistDraftOrder.mockResolvedValue({
      order: {
        id: 'draft-1', orderNumber: 1001, status: 'DRAFT', routeId: 'route-south',
        customerId: 'cust-001', deliveryWindowStart: new Date('2026-08-12T08:00:00.000Z'),
        idempotencyKey: null, revision: 1,
      },
    });

    const result = await actions.saveDraftOrderAction({
      customerId: 'cust-001',
      items: [{ productId: 'prod-a', qty: 2 }],
    });

    expect(result).toEqual({ ok: true, data: { orderId: 'draft-1' } });
    expect(mockedPersistDraftOrder).toHaveBeenCalledWith(expect.anything(), {
      payload: expect.objectContaining({
        order: expect.objectContaining({
          customerId: 'cust-001',
          status: 'DRAFT',
          submittedAt: null,
        }),
      }),
    });
  });

  it('queues lifecycle WhatsApp notifications after customer order submission', async () => {
    mockedAssertCustomerAction.mockResolvedValue({
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-001' },
      expires: '2026-07-01T00:00:00.000Z',
    });
    mockedCreateSubmittedOrder.mockResolvedValue({
      orderId: 'ord-customer',
      orderNumber: 1001,
      status: 'SUBMITTED',
      routeId: 'route-south',
      replayed: false,
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
      idempotencyKey,
      items: [{ productId: 'prod-a', qty: 2 }],
      notes: 'Call before arrival',
      paymentTerm: 'IMMEDIATE_OR_CASH',
      vatRatePercent: 18,
      commercialTermsAccepted: true,
    });

    expect(result).toEqual({
      ok: true,
      data: { orderId: 'ord-customer', status: 'SUBMITTED' },
    });
    expect(mockedCreateSubmittedOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey,
        paymentTerm: 'IMMEDIATE_OR_CASH',
        commercialTermsAccepted: true,
        expectedVatRatePercent: 18,
      }),
    );
    expect(mockedEnqueueOrderLifecycleWhatsApp).toHaveBeenCalledWith({ orderId: 'ord-customer' });
  });

  it('does not enqueue a duplicate lifecycle notification when a submission is replayed', async () => {
    mockedAssertCustomerAction.mockResolvedValue({
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-001' },
      expires: '2026-07-01T00:00:00.000Z',
    });
    mockedGetOrderWriteContext.mockResolvedValue({
      customer: { id: 'cust-001', routeId: 'route-south', priceListId: 'price-list-standard', isActive: true },
      route: {
        id: 'route-south', isActive: true,
        nextDeliveryAt: new Date('2026-07-10T08:00:00.000Z'),
        nextCutoffAt: new Date('2026-07-09T15:00:00.000Z'),
      },
      products: [{
        id: 'prod-a', name: 'Product A', category: 'Spreads', basePrice: 400,
        isActive: true, minQty: 1, orderMultiple: 1,
      }],
      priceListItems: [{ productId: 'prod-a', price: 400 }],
      promotions: [],
    });
    mockedCreateSubmittedOrder.mockResolvedValue({
      orderId: 'ord-customer', orderNumber: 1001, status: 'SUBMITTED',
      routeId: 'route-south', replayed: true,
    });

    const result = await actions.submitCustomerOrderAction({
      customerId: 'cust-001',
      idempotencyKey,
      items: [{ productId: 'prod-a', qty: 2 }],
      paymentTerm: 'NET_30',
      vatRatePercent: 18,
      commercialTermsAccepted: true,
    });

    expect(result.ok).toBe(true);
    expect(mockedEnqueueOrderLifecycleWhatsApp).not.toHaveBeenCalled();
  });

  it('rejects a customer order when the B2B declaration was not accepted', async () => {
    mockedAssertCustomerAction.mockResolvedValue({
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-001' },
      expires: '2026-07-01T00:00:00.000Z',
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
      products: [{
        id: 'prod-a',
        name: 'Product A',
        category: 'Spreads',
        basePrice: 100,
        isActive: true,
        minQty: 1,
        orderMultiple: 1,
      }],
      priceListItems: [{ productId: 'prod-a', price: 100 }],
      promotions: [],
    });

    const result = await actions.submitCustomerOrderAction({
      customerId: 'cust-001',
      idempotencyKey,
      items: [{ productId: 'prod-a', qty: 2 }],
      paymentTerm: 'NET_30',
      vatRatePercent: 18,
      commercialTermsAccepted: false,
    });

    expect(result.ok).toBe(false);
    expect(mockedCreateSubmittedOrder).not.toHaveBeenCalled();
  });

  it('rejects an unsupported payment term before creating an order', async () => {
    mockedAssertCustomerAction.mockResolvedValue({
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-001' },
      expires: '2026-07-01T00:00:00.000Z',
    });
    mockedCreateSubmittedOrder.mockResolvedValue({
      orderId: 'ord-customer',
      orderNumber: 1001,
      status: 'SUBMITTED',
      routeId: 'route-south',
      replayed: false,
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
      idempotencyKey,
      items: [{ productId: 'prod-a', qty: 2 }],
      paymentTerm: 'INVALID' as 'NET_30',
      vatRatePercent: 18,
      commercialTermsAccepted: true,
    });

    expect(result.ok).toBe(false);
    expect(mockedCreateSubmittedOrder).not.toHaveBeenCalled();
  });
});
