import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualOrderAction } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {},
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

const mockedAssertAdminAction = vi.mocked(assertAdminAction);
const mockedCreateSubmittedOrder = vi.mocked(createSubmittedOrder);

describe('admin CRM actions', () => {
  beforeEach(() => {
    mockedAssertAdminAction.mockReset();
    mockedCreateSubmittedOrder.mockReset();
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

    const result = await createManualOrderAction({
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

    const result = await createManualOrderAction({
      customerId: 'cust-001',
      intakeChannel: 'WHATSAPP',
      items: [{ productId: 'prod-a', quantity: 3 }],
    });

    expect(result).toEqual({ ok: false, error: 'Unauthorized' });
    expect(mockedCreateSubmittedOrder).not.toHaveBeenCalled();
  });
});
