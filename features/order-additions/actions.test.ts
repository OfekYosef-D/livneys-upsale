import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, AuthorizationError } from '@/lib/errors';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/authorization', () => ({
  assertAdminAction: vi.fn(),
  assertCustomerAction: vi.fn(),
}));
vi.mock('@/features/notifications/order-notifications', () => ({
  notifyOrderStatusInBackground: vi.fn(),
  notifyAdditionDecisionInBackground: vi.fn(),
}));
vi.mock('./service', () => ({
  submitOrderAddition: vi.fn(),
  reviewOrderAddition: vi.fn(),
}));

const { assertAdminAction, assertCustomerAction } = await import('@/lib/authorization');
const { notifyAdditionDecisionInBackground } = await import('@/features/notifications/order-notifications');
const { submitOrderAddition, reviewOrderAddition } = await import('./service');
const { createApprovedOrderAdditionAction, reviewOrderAdditionAction, submitOrderAdditionAction } = await import('./actions');

const addition = {
  customerId: 'cust-001',
  orderId: 'order-001',
  idempotencyKey: '1f4106db-26c3-49ed-9cf6-c625dd18fc73',
  items: [{ productId: 'product-001', quantity: 2 }],
};
const actor = { userId: 'u1', audit: expect.any(Function) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assertAdminAction).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);
  vi.mocked(assertCustomerAction).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER', customerId: 'cust-001' } } as never);
});

describe('submitOrderAdditionAction', () => {
  it('authorizes the customer and submits a pending addition request', async () => {
    vi.mocked(submitOrderAddition).mockResolvedValue({ requestId: 'request-001', replayed: false });

    const result = await submitOrderAdditionAction(addition);

    expect(result).toEqual({ ok: true, data: { requestId: 'request-001' } });
    expect(assertCustomerAction).toHaveBeenCalledWith('cust-001');
    expect(submitOrderAddition).toHaveBeenCalledWith({ ...addition, actor });
    expect(reviewOrderAddition).not.toHaveBeenCalled();
    expect(notifyAdditionDecisionInBackground).not.toHaveBeenCalled();
  });

  it('returns UNAUTHORIZED for another customer', async () => {
    vi.mocked(assertCustomerAction).mockRejectedValue(new AuthorizationError());

    const result = await submitOrderAdditionAction({ ...addition, customerId: 'cust-other' });

    expect(result).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(submitOrderAddition).not.toHaveBeenCalled();
  });

  it('surfaces a locked order as a business error', async () => {
    vi.mocked(submitOrderAddition).mockRejectedValue(new AppError('ORDER_LOCKED', 'ההזמנה כבר נארזה.'));

    const result = await submitOrderAdditionAction(addition);

    expect(result).toEqual({ ok: false, code: 'ORDER_LOCKED', error: 'ההזמנה כבר נארזה.' });
  });
});

describe('createApprovedOrderAdditionAction', () => {
  it('lets an admin register an addition that is approved immediately and notifies the customer', async () => {
    vi.mocked(submitOrderAddition).mockResolvedValue({ requestId: 'request-002', replayed: false });
    vi.mocked(reviewOrderAddition).mockResolvedValue({ orderId: 'order-001', customerId: 'cust-001', replayed: false } as never);

    const result = await createApprovedOrderAdditionAction(addition);

    expect(result).toEqual({ ok: true, data: { orderId: 'order-001', requestId: 'request-002' } });
    expect(assertCustomerAction).not.toHaveBeenCalled();
    expect(submitOrderAddition).toHaveBeenCalledWith({ ...addition, actor });
    expect(reviewOrderAddition).toHaveBeenCalledWith({ requestId: 'request-002', decision: 'APPROVED', reason: null, actor });
    expect(notifyAdditionDecisionInBackground).toHaveBeenCalledWith('request-002', 'APPROVED');
  });

  it('requires an admin session', async () => {
    vi.mocked(assertAdminAction).mockRejectedValue(new AuthorizationError());

    const result = await createApprovedOrderAdditionAction(addition);

    expect(result).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(submitOrderAddition).not.toHaveBeenCalled();
  });
});

describe('reviewOrderAdditionAction', () => {
  it('approves the request and notifies the customer', async () => {
    vi.mocked(reviewOrderAddition).mockResolvedValue({ orderId: 'order-001', customerId: 'cust-001', replayed: false } as never);

    const result = await reviewOrderAdditionAction({ requestId: 'request-001', decision: 'APPROVED' });

    expect(result).toEqual({ ok: true, data: { orderId: 'order-001', status: 'APPROVED' } });
    expect(reviewOrderAddition).toHaveBeenCalledWith({ requestId: 'request-001', decision: 'APPROVED', reason: null, actor });
    expect(notifyAdditionDecisionInBackground).toHaveBeenCalledWith('request-001', 'APPROVED');
  });

  it('rejects with a reason and notifies the customer', async () => {
    vi.mocked(reviewOrderAddition).mockResolvedValue({ orderId: 'order-001', customerId: 'cust-001', replayed: false } as never);

    const result = await reviewOrderAdditionAction({ requestId: 'request-001', decision: 'REJECTED', reason: ' אזל מהמלאי ' });

    expect(result).toEqual({ ok: true, data: { orderId: 'order-001', status: 'REJECTED' } });
    expect(reviewOrderAddition).toHaveBeenCalledWith(expect.objectContaining({ decision: 'REJECTED', reason: 'אזל מהמלאי' }));
    expect(notifyAdditionDecisionInBackground).toHaveBeenCalledWith('request-001', 'REJECTED');
  });

  it('does not notify again when the review is replayed', async () => {
    vi.mocked(reviewOrderAddition).mockResolvedValue({ orderId: 'order-001', customerId: 'cust-001', replayed: true } as never);

    const result = await reviewOrderAdditionAction({ requestId: 'request-001', decision: 'APPROVED' });

    expect(result.ok).toBe(true);
    expect(notifyAdditionDecisionInBackground).not.toHaveBeenCalled();
  });

  it('requires a rejection reason before reviewing', async () => {
    const result = await reviewOrderAdditionAction({ requestId: 'request-001', decision: 'REJECTED' });

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR', error: 'יש להזין סיבת דחייה.' });
    expect(reviewOrderAddition).not.toHaveBeenCalled();
  });

  it('requires an admin session', async () => {
    vi.mocked(assertAdminAction).mockRejectedValue(new AuthorizationError());

    const result = await reviewOrderAdditionAction({ requestId: 'request-001', decision: 'APPROVED' });

    expect(result).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(reviewOrderAddition).not.toHaveBeenCalled();
  });
});
