import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as actions from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/action-result', () => ({
  actionOk: (data: unknown) => ({ ok: true, data }),
  actionError: (error: unknown) => ({
    ok: false,
    error: error instanceof Error ? error.message : 'Unexpected error',
  }),
}));

vi.mock('@/features/orders/service', () => ({
  createSubmittedOrder: vi.fn(),
}));

vi.mock('@/features/orders/utils', async () => await vi.importActual('../orders/utils'));


vi.mock('@/features/orders/write', () => ({
  formatManualOrderInternalNote: vi.fn(({ intakeChannel, note }: { intakeChannel: string; note?: string | null }) =>
    note ? `[manual-order:intake=${intakeChannel}] ${note}` : `[manual-order:intake=${intakeChannel}]`,
  ),
}));

vi.mock('../notifications/jobs', () => ({
  enqueueOrderLifecycleWhatsApp: vi.fn(),
}));

vi.mock('@/lib/authorization', () => {
  class AuthorizationError extends Error {
    constructor(message = 'Unauthorized') {
      super(message);
      this.name = 'AuthorizationError';
    }
  }

  return {
    AuthorizationError,
    assertAdminAction: vi.fn(),
  };
});

const { assertAdminAction } = await import('@/lib/authorization');
const { createSubmittedOrder } = await import('@/features/orders/service');
const { enqueueOrderLifecycleWhatsApp } = await import('../notifications/jobs');
const { revalidatePath } = await import('next/cache');
const { prisma } = await import('@/lib/db');

const mockedAssertAdminAction = vi.mocked(assertAdminAction);
const mockedCreateSubmittedOrder = vi.mocked(createSubmittedOrder);
const mockedEnqueueOrderLifecycleWhatsApp = vi.mocked(enqueueOrderLifecycleWhatsApp);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedOrderFindUnique = vi.mocked(prisma.order.findUnique);
const mockedOrderUpdate = vi.mocked(prisma.order.update);
const idempotencyKey = '8f82b072-99be-45e7-b1aa-2ca4d92fc8d2';

describe('admin CRM actions', () => {
  beforeEach(() => {
    mockedAssertAdminAction.mockReset();
    mockedCreateSubmittedOrder.mockReset();
    mockedEnqueueOrderLifecycleWhatsApp.mockReset();
    mockedRevalidatePath.mockReset();
    mockedOrderFindUnique.mockReset();
    mockedOrderUpdate.mockReset();
  });

  it('creates manual orders through the shared order service as admin orders', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-06-27T00:00:00.000Z',
    });
    mockedCreateSubmittedOrder.mockResolvedValue({
      orderId: 'ord-manual',
      orderNumber: 1002,
      status: 'SUBMITTED',
      routeId: 'route-south',
      replayed: false,
    });

    const result = await actions.createManualOrderAction({
      customerId: 'cust-001',
      idempotencyKey,
      intakeChannel: 'PHONE',
      notes: 'Call before delivery',
      internalNote: 'Ordered with Shai',
      items: [{ productId: 'prod-a', quantity: 3 }],
    });

    expect(result).toEqual({
      ok: true,
      data: { orderId: 'ord-manual', status: 'SUBMITTED' },
    });
    expect(mockedCreateSubmittedOrder).toHaveBeenCalledWith({
      customerId: 'cust-001',
      idempotencyKey,
      items: [{ productId: 'prod-a', quantity: 3 }],
      source: 'ADMIN',
      paymentTerm: 'NET_30',
      notes: 'Call before delivery',
      internalNote: '[manual-order:intake=PHONE] Ordered with Shai',
    });
    expect(mockedEnqueueOrderLifecycleWhatsApp).toHaveBeenCalledWith({ orderId: 'ord-manual' });
  });

  it('rejects manual order creation before any write when the session is not admin', async () => {
    mockedAssertAdminAction.mockRejectedValue(new Error('Unauthorized'));

    const result = await actions.createManualOrderAction({
      customerId: 'cust-001',
      idempotencyKey,
      intakeChannel: 'WHATSAPP',
      items: [{ productId: 'prod-a', quantity: 3 }],
    });

    expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    expect(mockedCreateSubmittedOrder).not.toHaveBeenCalled();
  });

  it('updates order status through a valid admin transition', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-06-27T00:00:00.000Z',
    });
    mockedOrderFindUnique.mockResolvedValue({
      id: 'ord-123',
      status: 'SUBMITTED',
      customerId: 'cust-001',
      routeId: 'route-south',
    } as never);
    mockedOrderUpdate.mockResolvedValue({
      id: 'ord-123',
      status: 'APPROVED',
      customerId: 'cust-001',
      routeId: 'route-south',
    } as never);

    expect(actions.updateOrderStatusAction).toBeTypeOf('function');

    const result = await actions.updateOrderStatusAction({
      orderId: 'ord-123',
      status: 'APPROVED',
    });

    expect(result).toEqual({
      ok: true,
      data: { orderId: 'ord-123', status: 'APPROVED' },
    });
    expect(mockedOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'ord-123' },
      data: { status: 'APPROVED', revision: { increment: 1 } },
      select: {
        id: true,
        status: true,
        customerId: true,
        routeId: true,
      },
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin/orders/ord-123');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin/customers/cust-001');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin/routes/route-south');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/customer/cust-001');
    expect(mockedEnqueueOrderLifecycleWhatsApp).toHaveBeenCalledWith({
      orderId: 'ord-123',
      templateKey: 'ORDER_APPROVED',
    });
  });

  it('rejects invalid order status transitions before updating', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-06-27T00:00:00.000Z',
    });
    mockedOrderFindUnique.mockResolvedValue({
      id: 'ord-123',
      status: 'DELIVERED',
      customerId: 'cust-001',
      routeId: 'route-south',
    } as never);

    expect(actions.updateOrderStatusAction).toBeTypeOf('function');

    const result = await actions.updateOrderStatusAction({
      orderId: 'ord-123',
      status: 'APPROVED',
    });

    expect(result).toEqual({
      ok: false,
      error: 'Invalid order status transition: DELIVERED -> APPROVED',
    });
    expect(mockedOrderUpdate).not.toHaveBeenCalled();
  });

  it('blocks packing while an addition request is pending', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-06-27T00:00:00.000Z',
    });
    mockedOrderFindUnique.mockResolvedValue({
      id: 'ord-123',
      status: 'APPROVED',
      customerId: 'cust-001',
      routeId: 'route-south',
      additionRequests: [{ id: 'request-001' }],
    } as never);

    const result = await actions.updateOrderStatusAction({ orderId: 'ord-123', status: 'PACKED' });

    expect(result).toEqual({
      ok: false,
      error: 'יש לאשר או לדחות את בקשת התוספת לפני אריזת ההזמנה.',
    });
    expect(mockedOrderUpdate).not.toHaveBeenCalled();
  });

  it('rejects order status updates before any database read when the session is not admin', async () => {
    mockedAssertAdminAction.mockRejectedValue(new Error('Unauthorized'));

    expect(actions.updateOrderStatusAction).toBeTypeOf('function');

    const result = await actions.updateOrderStatusAction({
      orderId: 'ord-123',
      status: 'APPROVED',
    });

    expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    expect(mockedOrderFindUnique).not.toHaveBeenCalled();
    expect(mockedOrderUpdate).not.toHaveBeenCalled();
  });
});
