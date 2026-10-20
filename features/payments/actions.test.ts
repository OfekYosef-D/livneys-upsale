import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

const assertAdminAction = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/authorization', () => ({ assertAdminAction, assertCustomerAction: vi.fn() }));

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { AuthorizationError } = await import('@/lib/errors');
const { recordPaymentReceiptAction, voidPaymentReceiptAction } = await import('./actions');

const validInput = {
  orderId: 'order-1',
  idempotencyKey: '9d31ee3f-3eb9-4cbc-b0ff-d48ed1daed71',
  amount: '25.50',
  method: 'CASH',
  receivedAt: '2026-08-12T08:00:00.000Z',
  reference: '',
  note: '',
};

beforeEach(() => {
  db.$reset();
  assertAdminAction.mockReset();
  assertAdminAction.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
  db.auditLog.create.mockResolvedValue({});
});

describe('payment actions', () => {
  it('are admin-only', async () => {
    assertAdminAction.mockRejectedValue(new AuthorizationError());
    await expect(recordPaymentReceiptAction(validInput)).resolves.toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    await expect(voidPaymentReceiptAction({ receiptId: 'r-1', reason: 'כפילות' })).resolves.toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('records a receipt attributed to the signed-in admin with an audit row', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue(null);
    db.order.findUnique.mockResolvedValue({
      id: 'order-1', customerId: 'cust-1', orderNumber: 1007, status: 'DELIVERED', totalIncludingVat: 118, paymentReceipts: [],
    });
    db.paymentReceipt.create.mockResolvedValue({ id: 'receipt-1' });

    await expect(recordPaymentReceiptAction(validInput)).resolves.toEqual({
      ok: true, data: { receiptId: 'receipt-1', orderId: 'order-1', replayed: false },
    });
    expect(db.paymentReceipt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 25.5, reference: null, note: null, recordedByUserId: 'admin-1' }),
    }));
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'PAYMENT_RECORDED', actorUserId: 'admin-1', actorRole: 'ADMIN' }),
    });
  });

  it('returns Hebrew validation messages for bad input', async () => {
    await expect(recordPaymentReceiptAction({ ...validInput, amount: 0 }))
      .resolves.toEqual({ ok: false, code: 'VALIDATION_ERROR', error: 'הסכום חייב להיות גדול מאפס.' });
    await expect(recordPaymentReceiptAction({ ...validInput, amount: 1.005 }))
      .resolves.toEqual({ ok: false, code: 'VALIDATION_ERROR', error: 'ניתן להזין עד שתי ספרות אחרי הנקודה.' });
    await expect(voidPaymentReceiptAction({ receiptId: 'r-1', reason: ' x ' }))
      .resolves.toEqual({ ok: false, code: 'VALIDATION_ERROR', error: 'יש להזין סיבת ביטול.' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('voids a receipt through the admin action', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue({ id: 'r-1', orderId: 'order-1', amount: 25.5, status: 'RECORDED', order: { customerId: 'cust-1' } });
    db.paymentReceipt.updateMany.mockResolvedValue({ count: 1 });
    await expect(voidPaymentReceiptAction({ receiptId: 'r-1', reason: 'אסמכתא שגויה' })).resolves.toEqual({ ok: true, data: { orderId: 'order-1' } });
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'PAYMENT_VOIDED' }) });
  });
});
