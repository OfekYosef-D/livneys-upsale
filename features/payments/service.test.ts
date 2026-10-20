import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { actionError } = await import('@/lib/action-result');
const { getPaymentSummary, recordPaymentReceipt, voidPaymentReceipt } = await import('./service');

const audit = vi.fn();
const key = '9d31ee3f-3eb9-4cbc-b0ff-d48ed1daed71';
const receiptInput = {
  orderId: 'order-1',
  idempotencyKey: key,
  amount: 50,
  method: 'BANK_TRANSFER' as const,
  reference: 'BANK-42',
  receivedAt: new Date('2026-08-12T08:00:00.000Z'),
  note: null,
  actorUserId: 'admin-1',
  audit,
};
const deliveredOrder = (receipts: Array<{ amount: number; status: 'RECORDED' | 'VOIDED' }>) => ({
  id: 'order-1', customerId: 'cust-1', orderNumber: 1007, status: 'DELIVERED', totalIncludingVat: 118, paymentReceipts: receipts,
});

beforeEach(() => {
  db.$reset();
  audit.mockReset();
});

describe('payment summary', () => {
  it('derives unpaid, partial, and paid states from non-voided receipts', () => {
    expect(getPaymentSummary(118, [])).toEqual({ status: 'UNPAID', paidTotal: 0, outstanding: 118 });
    expect(getPaymentSummary(118, [{ amount: 40, status: 'RECORDED' }])).toEqual({ status: 'PARTIALLY_PAID', paidTotal: 40, outstanding: 78 });
    expect(getPaymentSummary(118, [
      { amount: 40, status: 'VOIDED' },
      { amount: 118, status: 'RECORDED' },
    ])).toEqual({ status: 'PAID', paidTotal: 118, outstanding: 0 });
  });

  it('handles decimal amounts without floating point drift', () => {
    expect(getPaymentSummary(0.3, [{ amount: '0.1', status: 'RECORDED' }, { amount: '0.2', status: 'RECORDED' }]))
      .toEqual({ status: 'PAID', paidTotal: 0.3, outstanding: 0 });
  });
});

describe('recording receipts', () => {
  it('records a receipt and its audit entry in one serializable transaction', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue(null);
    db.order.findUnique.mockResolvedValue(deliveredOrder([{ amount: 30, status: 'RECORDED' }]));
    db.paymentReceipt.create.mockResolvedValue({ id: 'receipt-1' });

    await expect(recordPaymentReceipt(receiptInput)).resolves.toEqual({ receiptId: 'receipt-1', orderId: 'order-1', replayed: false });

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(db.paymentReceipt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: 'order-1', idempotencyKey: key, amount: 50, recordedByUserId: 'admin-1', status: 'RECORDED',
      }),
    }));
    expect(audit).toHaveBeenCalledWith(db, expect.objectContaining({
      action: 'PAYMENT_RECORDED', entityType: 'PaymentReceipt', entityId: 'receipt-1', customerId: 'cust-1',
    }));
  });

  it('returns the original receipt without another balance check or audit on replay', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue({ id: 'receipt-existing', orderId: 'order-1' });

    await expect(recordPaymentReceipt(receiptInput)).resolves.toEqual({ receiptId: 'receipt-existing', orderId: 'order-1', replayed: true });
    expect(db.order.findUnique).not.toHaveBeenCalled();
    expect(db.paymentReceipt.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key that already belongs to another order', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue({ id: 'receipt-existing', orderId: 'order-2' });
    await expect(recordPaymentReceipt(receiptInput)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_CONFLICT' });
    expect(db.paymentReceipt.create).not.toHaveBeenCalled();
  });

  it('resolves a concurrent duplicate insert as a replay instead of failing', async () => {
    db.paymentReceipt.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'receipt-winner', orderId: 'order-1' });
    db.order.findUnique.mockResolvedValue(deliveredOrder([]));
    db.paymentReceipt.create.mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));

    await expect(recordPaymentReceipt(receiptInput)).resolves.toEqual({ receiptId: 'receipt-winner', orderId: 'order-1', replayed: true });
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects an amount above the remaining gross balance with a Hebrew message', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue(null);
    db.order.findUnique.mockResolvedValue(deliveredOrder([{ amount: 100, status: 'RECORDED' }, { amount: 50, status: 'VOIDED' }]));

    const promise = recordPaymentReceipt({ ...receiptInput, amount: 20 });
    await expect(promise).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE', details: { outstanding: 18 } });
    expect(actionError(await promise.catch((error) => error))).toEqual({
      ok: false, code: 'PAYMENT_EXCEEDS_BALANCE', error: 'סכום התקבול גבוה מהיתרה הפתוחה בהזמנה.', details: { outstanding: 18 },
    });
    expect(db.paymentReceipt.create).not.toHaveBeenCalled();
  });

  it('accepts exactly the remaining balance', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue(null);
    db.order.findUnique.mockResolvedValue(deliveredOrder([{ amount: 100, status: 'RECORDED' }]));
    db.paymentReceipt.create.mockResolvedValue({ id: 'receipt-2' });
    await expect(recordPaymentReceipt({ ...receiptInput, amount: 18 })).resolves.toMatchObject({ replayed: false });
  });

  it.each(['DRAFT', 'CANCELLED'])('refuses receipts for a %s order', async (status) => {
    db.paymentReceipt.findUnique.mockResolvedValue(null);
    db.order.findUnique.mockResolvedValue({ ...deliveredOrder([]), status });
    await expect(recordPaymentReceipt(receiptInput)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('reports a missing order', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue(null);
    db.order.findUnique.mockResolvedValue(null);
    await expect(recordPaymentReceipt(receiptInput)).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'ההזמנה לא נמצאה.' });
  });
});

describe('voiding receipts', () => {
  const now = new Date('2026-08-13T10:00:00.000Z');

  it('voids a receipt once with a mandatory reason and audit trail', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue({ id: 'receipt-1', orderId: 'order-1', amount: 50, status: 'RECORDED', order: { customerId: 'cust-1' } });
    db.paymentReceipt.updateMany.mockResolvedValue({ count: 1 });

    await expect(voidPaymentReceipt({ receiptId: 'receipt-1', reason: 'אסמכתא שגויה', actorUserId: 'admin-1', audit, now }))
      .resolves.toEqual({ orderId: 'order-1' });
    expect(db.paymentReceipt.updateMany).toHaveBeenCalledWith({
      where: { id: 'receipt-1', status: 'RECORDED' },
      data: { status: 'VOIDED', voidedAt: now, voidedByUserId: 'admin-1', voidReason: 'אסמכתא שגויה' },
    });
    expect(audit).toHaveBeenCalledWith(db, expect.objectContaining({
      action: 'PAYMENT_VOIDED', entityId: 'receipt-1', customerId: 'cust-1',
      after: { status: 'VOIDED', voidedAt: now, voidReason: 'אסמכתא שגויה' },
    }));
  });

  it('does not void an already voided receipt twice', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue({ id: 'receipt-1', orderId: 'order-1', amount: 50, status: 'VOIDED', order: { customerId: 'cust-1' } });
    db.paymentReceipt.updateMany.mockResolvedValue({ count: 0 });

    await expect(voidPaymentReceipt({ receiptId: 'receipt-1', reason: 'כפילות', actorUserId: 'admin-1', audit, now }))
      .rejects.toMatchObject({ code: 'STALE_VERSION', message: 'התקבול כבר בוטל או השתנה. רעננו את המסך.' });
    expect(audit).not.toHaveBeenCalled();
  });

  it('reports a missing receipt', async () => {
    db.paymentReceipt.findUnique.mockResolvedValue(null);
    await expect(voidPaymentReceipt({ receiptId: 'missing', reason: 'כפילות', actorUserId: 'admin-1', audit }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
