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
vi.mock('@/features/orders/service', () => ({
  submitOrder: vi.fn(),
  saveDraftOrder: vi.fn(),
  changeOrderStatus: vi.fn(),
}));

const { assertCustomerAction } = await import('@/lib/authorization');
const { revalidatePath } = await import('next/cache');
const { notifyOrderStatusInBackground } = await import('@/features/notifications/order-notifications');
const { saveDraftOrder, submitOrder } = await import('@/features/orders/service');
const { saveDraftOrderAction, submitCustomerOrderAction } = await import('./actions');

const idempotencyKey = '9d31ee3f-3eb9-4cbc-b0ff-d48ed1daed71';
const submission = {
  customerId: 'cust-001',
  idempotencyKey,
  items: [{ productId: 'prod-a', quantity: 2 }],
  notes: 'Call before arrival',
  paymentTerm: 'IMMEDIATE_OR_CASH',
  vatRatePercent: 18,
  legalDocumentSetVersion: '2026-08-12-review',
  commercialTermsAccepted: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assertCustomerAction).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER', customerId: 'cust-001' } } as never);
});

describe('saveDraftOrderAction', () => {
  it('authorizes against the payload customer and delegates to saveDraftOrder', async () => {
    vi.mocked(saveDraftOrder).mockResolvedValue({ orderId: 'draft-1' });

    const result = await saveDraftOrderAction({ customerId: 'cust-001', items: [{ productId: 'prod-a', quantity: 2 }] });

    expect(result).toEqual({ ok: true, data: { orderId: 'draft-1' } });
    expect(assertCustomerAction).toHaveBeenCalledWith('cust-001');
    expect(saveDraftOrder).toHaveBeenCalledWith('cust-001', [{ productId: 'prod-a', quantity: 2 }]);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('passes an empty cart through so the draft can be cancelled', async () => {
    vi.mocked(saveDraftOrder).mockResolvedValue({ orderId: null });

    const result = await saveDraftOrderAction({ customerId: 'cust-001', items: [] });

    expect(result).toEqual({ ok: true, data: { orderId: null } });
    expect(saveDraftOrder).toHaveBeenCalledWith('cust-001', []);
  });

  it('returns UNAUTHORIZED when the signed-in user does not own the customer', async () => {
    vi.mocked(assertCustomerAction).mockRejectedValue(new AuthorizationError());

    const result = await saveDraftOrderAction({ customerId: 'cust-other', items: [] });

    expect(result).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(saveDraftOrder).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('submitCustomerOrderAction', () => {
  it('submits a CUSTOMER order with the confirmed totals and notifies', async () => {
    vi.mocked(submitOrder).mockResolvedValue({ orderId: 'ord-customer', orderNumber: 1001, status: 'SUBMITTED', replayed: false });

    const result = await submitCustomerOrderAction(submission);

    expect(result).toEqual({ ok: true, data: { orderId: 'ord-customer', status: 'SUBMITTED' } });
    expect(submitOrder).toHaveBeenCalledWith({
      customerId: 'cust-001',
      items: [{ productId: 'prod-a', quantity: 2 }],
      source: 'CUSTOMER',
      idempotencyKey,
      paymentTerm: 'IMMEDIATE_OR_CASH',
      commercialTermsAccepted: true,
      notes: 'Call before arrival',
      expectedVatRatePercent: 18,
      expectedLegalDocumentSetVersion: '2026-08-12-review',
      actor: { userId: 'u1', audit: expect.any(Function) },
    });
    expect(notifyOrderStatusInBackground).toHaveBeenCalledWith('ord-customer');
  });

  it('does not notify again when the submission is replayed', async () => {
    vi.mocked(submitOrder).mockResolvedValue({ orderId: 'ord-customer', orderNumber: 1001, status: 'SUBMITTED', replayed: true });

    const result = await submitCustomerOrderAction(submission);

    expect(result.ok).toBe(true);
    expect(notifyOrderStatusInBackground).not.toHaveBeenCalled();
  });

  it('rejects an order without the B2B declaration before authorization or submission', async () => {
    const result = await submitCustomerOrderAction({ ...submission, commercialTermsAccepted: false });

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(assertCustomerAction).not.toHaveBeenCalled();
    expect(submitOrder).not.toHaveBeenCalled();
  });

  it('rejects an unsupported payment term', async () => {
    const result = await submitCustomerOrderAction({ ...submission, paymentTerm: 'INVALID' });

    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(submitOrder).not.toHaveBeenCalled();
  });

  it('returns UNAUTHORIZED for another customer', async () => {
    vi.mocked(assertCustomerAction).mockRejectedValue(new AuthorizationError());

    const result = await submitCustomerOrderAction({ ...submission, customerId: 'cust-other' });

    expect(result).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(assertCustomerAction).toHaveBeenCalledWith('cust-other');
    expect(submitOrder).not.toHaveBeenCalled();
  });

  it('surfaces business errors from the order service', async () => {
    vi.mocked(submitOrder).mockRejectedValue(new AppError('STALE_VERSION', 'המחירים השתנו.'));

    const result = await submitCustomerOrderAction(submission);

    expect(result).toEqual({ ok: false, code: 'STALE_VERSION', error: 'המחירים השתנו.' });
    expect(notifyOrderStatusInBackground).not.toHaveBeenCalled();
  });
});
