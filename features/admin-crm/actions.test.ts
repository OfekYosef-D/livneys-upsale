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


vi.mock('@/features/orders/write', () => ({
  formatManualOrderInternalNote: vi.fn(({ intakeChannel, note }: { intakeChannel: string; note?: string | null }) =>
    note ? `[manual-order:intake=${intakeChannel}] ${note}` : `[manual-order:intake=${intakeChannel}]`,
  ),
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
const { revalidatePath } = await import('next/cache');
const { prisma } = await import('@/lib/db');

const mockedAssertAdminAction = vi.mocked(assertAdminAction);
const mockedCreateSubmittedOrder = vi.mocked(createSubmittedOrder);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedOrderFindUnique = vi.mocked(prisma.order.findUnique);
const mockedOrderUpdate = vi.mocked(prisma.order.update);

describe('admin CRM actions', () => {
  beforeEach(() => {
    mockedAssertAdminAction.mockReset();
    mockedCreateSubmittedOrder.mockReset();
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
      status: 'SUBMITTED',
      routeId: 'route-south',
    });

    const result = await actions.createManualOrderAction({
      customerId: 'cust-001',
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
      items: [{ productId: 'prod-a', quantity: 3 }],
      source: 'ADMIN',
      notes: 'Call before delivery',
      internalNote: '[manual-order:intake=PHONE] Ordered with Shai',
    });
  });

  it('rejects manual order creation before any write when the session is not admin', async () => {
    mockedAssertAdminAction.mockRejectedValue(new Error('Unauthorized'));

    const result = await actions.createManualOrderAction({
      customerId: 'cust-001',
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
    });
    mockedOrderUpdate.mockResolvedValue({
      id: 'ord-123',
      status: 'APPROVED',
      customerId: 'cust-001',
      routeId: 'route-south',
    });

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
      data: { status: 'APPROVED' },
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
    });

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
