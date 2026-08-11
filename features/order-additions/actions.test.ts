import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/authorization', () => ({
  assertCustomerAction: vi.fn(),
  assertAdminAction: vi.fn(),
  AuthorizationError: class AuthorizationError extends Error {},
}));
vi.mock('../../lib/db', () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock('./service', () => ({ submitOrderAddition: vi.fn() }));
vi.mock('./persistence', () => ({ approveAdditionRequest: vi.fn(), rejectAdditionRequest: vi.fn() }));
vi.mock('./notifications', () => ({ enqueueOrderAdditionDecisionNotifications: vi.fn() }));

const { assertAdminAction, assertCustomerAction } = await import('../../lib/authorization');
const { prisma } = await import('../../lib/db');
const { submitOrderAddition } = await import('./service');
const { approveAdditionRequest, rejectAdditionRequest } = await import('./persistence');
const { enqueueOrderAdditionDecisionNotifications } = await import('./notifications');
const { createApprovedOrderAdditionAction, reviewOrderAdditionAction, submitOrderAdditionAction } = await import('./actions');

describe('order addition actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('authorizes the customer and submits an additions-only request', async () => {
    vi.mocked(assertCustomerAction).mockResolvedValue({ user: { id: 'customer-user-001' } } as never);
    vi.mocked(submitOrderAddition).mockResolvedValue({ requestId: 'request-001', status: 'PENDING', replayed: false });

    const result = await submitOrderAdditionAction({
      customerId: 'cust-001', orderId: 'order-001',
      idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
      items: [{ productId: 'product-001', quantity: 2 }],
    });

    expect(result).toEqual({ ok: true, data: { requestId: 'request-001', status: 'PENDING' } });
    expect(submitOrderAddition).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 'customer-user-001' }));
  });

  it('approves in a serializable transaction and queues customer notifications', async () => {
    vi.mocked(assertAdminAction).mockResolvedValue({ user: { id: 'admin-001' } } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback({} as never));
    vi.mocked(approveAdditionRequest).mockResolvedValue({ orderId: 'order-001', customerId: 'cust-001', replayed: false });

    const result = await reviewOrderAdditionAction({ requestId: 'request-001', decision: 'APPROVED' });

    expect(result).toEqual({ ok: true, data: { orderId: 'order-001', status: 'APPROVED' } });
    expect(enqueueOrderAdditionDecisionNotifications).toHaveBeenCalledWith({ requestId: 'request-001', decision: 'APPROVED' });
  });

  it('requires a reason and rejects without calling approval', async () => {
    const result = await reviewOrderAdditionAction({ requestId: 'request-001', decision: 'REJECTED' });
    expect(result.ok).toBe(false);
    expect(approveAdditionRequest).not.toHaveBeenCalled();
    expect(rejectAdditionRequest).not.toHaveBeenCalled();
  });

  it('lets an admin register an immediately approved addition on an existing order', async () => {
    vi.mocked(assertAdminAction).mockResolvedValue({ user: { id: 'admin-001' } } as never);
    vi.mocked(submitOrderAddition).mockResolvedValue({ requestId: 'request-002', status: 'PENDING', replayed: false });
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback({} as never));
    vi.mocked(approveAdditionRequest).mockResolvedValue({ orderId: 'order-001', customerId: 'cust-001', replayed: false });

    const result = await createApprovedOrderAdditionAction({
      customerId: 'cust-001', orderId: 'order-001',
      idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
      items: [{ productId: 'product-001', quantity: 2 }],
    });

    expect(result).toEqual({ ok: true, data: { orderId: 'order-001', requestId: 'request-002', status: 'APPROVED' } });
    expect(approveAdditionRequest).toHaveBeenCalledWith({}, expect.objectContaining({ requestId: 'request-002', reviewerUserId: 'admin-001' }));
  });

  it('retries a serializable review race', async () => {
    vi.mocked(assertAdminAction).mockResolvedValue({ user: { id: 'admin-001' } } as never);
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback) => callback({} as never));
    vi.mocked(approveAdditionRequest).mockResolvedValue({ orderId: 'order-001', customerId: 'cust-001', replayed: false });

    await expect(reviewOrderAdditionAction({ requestId: 'request-001', decision: 'APPROVED' })).resolves.toMatchObject({ ok: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
