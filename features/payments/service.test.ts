import { describe, expect, it, vi } from 'vitest';
import {
  getPaymentSummary,
  recordPaymentReceiptInTransaction,
  voidPaymentReceiptInTransaction,
} from './service';

describe('manual payment receipts', () => {
  it('derives unpaid, partial, and paid states from non-voided receipts', () => {
    expect(getPaymentSummary(118, [])).toMatchObject({ status: 'UNPAID', paidTotal: 0, outstanding: 118 });
    expect(getPaymentSummary(118, [{ amount: 40, status: 'RECORDED' }])).toMatchObject({ status: 'PARTIALLY_PAID', paidTotal: 40, outstanding: 78 });
    expect(getPaymentSummary(118, [
      { amount: 40, status: 'VOIDED' },
      { amount: 118, status: 'RECORDED' },
    ])).toMatchObject({ status: 'PAID', paidTotal: 118, outstanding: 0 });
  });

  it('records a receipt and its audit entry in one transaction', async () => {
    const tx = {
      order: { findUnique: vi.fn(async () => ({
        id: 'order-1', customerId: 'cust-1', orderNumber: 1007, status: 'DELIVERED', totalIncludingVat: 118,
        paymentReceipts: [{ amount: 30, status: 'RECORDED' }],
      })) },
      paymentReceipt: { create: vi.fn(async () => ({ id: 'receipt-1' })) },
      auditLog: { create: vi.fn() },
    };
    await expect(recordPaymentReceiptInTransaction(tx as never, {
      orderId: 'order-1', amount: 50, method: 'BANK_TRANSFER', reference: 'BANK-42',
      receivedAt: new Date('2026-08-12T08:00:00.000Z'), note: null, actorUserId: 'admin-1',
    })).resolves.toEqual({ receiptId: 'receipt-1' });

    expect(tx.paymentReceipt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: 'order-1', amount: 50, recordedByUserId: 'admin-1', status: 'RECORDED',
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: 'PAYMENT_RECORDED', entityType: 'PaymentReceipt', entityId: 'receipt-1',
    }) });
  });

  it('rejects an amount above the remaining gross balance', async () => {
    const tx = {
      order: { findUnique: vi.fn(async () => ({
        id: 'order-1', customerId: 'cust-1', orderNumber: 1007, status: 'DELIVERED', totalIncludingVat: 118,
        paymentReceipts: [{ amount: 100, status: 'RECORDED' }],
      })) },
      paymentReceipt: { create: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    await expect(recordPaymentReceiptInTransaction(tx as never, {
      orderId: 'order-1', amount: 20, method: 'CASH', reference: null,
      receivedAt: new Date(), note: null, actorUserId: 'admin-1',
    })).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE' });
    expect(tx.paymentReceipt.create).not.toHaveBeenCalled();
  });

  it('voids a receipt once with a mandatory reason and audit trail', async () => {
    const tx = {
      paymentReceipt: {
        findUnique: vi.fn(async () => ({ id: 'receipt-1', orderId: 'order-1', amount: 50, status: 'RECORDED', order: { customerId: 'cust-1' } })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      auditLog: { create: vi.fn() },
    };
    await expect(voidPaymentReceiptInTransaction(tx as never, { receiptId: 'receipt-1', reason: 'אסמכתא שגויה', actorUserId: 'admin-1' }))
      .resolves.toEqual({ orderId: 'order-1' });
    expect(tx.paymentReceipt.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'receipt-1', status: 'RECORDED' },
      data: expect.objectContaining({ status: 'VOIDED', voidedByUserId: 'admin-1', voidReason: 'אסמכתא שגויה' }),
    }));
  });
});
