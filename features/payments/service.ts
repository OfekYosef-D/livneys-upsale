import type { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError, NotFoundError, StaleVersionError } from '@/lib/errors';
import { roundCurrency, sumCurrency } from '@/lib/money';
import { runSerializable } from '@/lib/transactions';
import type { RecordAudit } from '../audit/log';

/**
 * Manual collection tracking (not invoicing): the team records money received against an order.
 * Receipts are never deleted, only voided with a reason, and every change is audited.
 */

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export function getPaymentSummary(totalIncludingVat: number, receipts: ReadonlyArray<{ amount: unknown; status: 'RECORDED' | 'VOIDED' }>) {
  const paidTotal = sumCurrency(receipts.filter((receipt) => receipt.status === 'RECORDED'), (receipt) => Number(receipt.amount));
  const outstanding = roundCurrency(Math.max(0, totalIncludingVat - paidTotal));
  const status: PaymentStatus = paidTotal <= 0 ? 'UNPAID' : outstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
  return { status, paidTotal, outstanding };
}

export async function recordPaymentReceipt(input: {
  orderId: string;
  idempotencyKey: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: Date;
  note: string | null;
  actorUserId: string;
  audit: RecordAudit;
}): Promise<{ receiptId: string; orderId: string; replayed: boolean }> {
  const findReplay = async () => {
    const existing = await prisma.paymentReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, orderId: true } });
    if (!existing) return undefined;
    if (existing.orderId !== input.orderId) {
      throw new AppError('IDEMPOTENCY_KEY_CONFLICT', 'הבקשה כבר שויכה לתקבול אחר. רעננו את המסך ונסו שוב.');
    }
    return { receiptId: existing.id, orderId: existing.orderId, replayed: true };
  };

  const replay = await findReplay();
  if (replay) return replay;

  return runSerializable(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, customerId: true, orderNumber: true, status: true, totalIncludingVat: true, paymentReceipts: { select: { amount: true, status: true } } },
    });
    if (!order) throw new NotFoundError('ההזמנה לא נמצאה.');
    if (order.status === 'DRAFT' || order.status === 'CANCELLED') {
      throw new AppError('INVALID_STATE', 'לא ניתן לרשום תקבול להזמנה במצב זה.');
    }

    const { outstanding } = getPaymentSummary(Number(order.totalIncludingVat), order.paymentReceipts);
    if (input.amount > outstanding + 0.001) {
      throw new AppError('PAYMENT_EXCEEDS_BALANCE', 'סכום התקבול גבוה מהיתרה הפתוחה בהזמנה.', { outstanding });
    }

    const receipt = await tx.paymentReceipt.create({
      data: {
        orderId: order.id,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
        receivedAt: input.receivedAt,
        note: input.note,
        status: 'RECORDED',
        recordedByUserId: input.actorUserId,
      },
      select: { id: true },
    });
    await input.audit(tx, {
      customerId: order.customerId,
      entityType: 'PaymentReceipt',
      entityId: receipt.id,
      action: 'PAYMENT_RECORDED',
      after: { orderId: order.id, orderNumber: order.orderNumber, amount: input.amount, method: input.method, reference: input.reference, receivedAt: input.receivedAt },
    });
    return { receiptId: receipt.id, orderId: order.id, replayed: false };
  }, { onConflict: findReplay });
}

export function voidPaymentReceipt(input: { receiptId: string; reason: string; actorUserId: string; audit: RecordAudit; now?: Date }) {
  const now = input.now ?? new Date();
  return runSerializable(async (tx) => {
    const receipt = await tx.paymentReceipt.findUnique({
      where: { id: input.receiptId },
      select: { id: true, orderId: true, amount: true, status: true, order: { select: { customerId: true } } },
    });
    if (!receipt) throw new NotFoundError('התקבול לא נמצא.');

    const changed = await tx.paymentReceipt.updateMany({
      where: { id: receipt.id, status: 'RECORDED' },
      data: { status: 'VOIDED', voidedAt: now, voidedByUserId: input.actorUserId, voidReason: input.reason },
    });
    if (changed.count !== 1) throw new StaleVersionError('התקבול כבר בוטל או השתנה. רעננו את המסך.');

    await input.audit(tx, {
      customerId: receipt.order.customerId,
      entityType: 'PaymentReceipt',
      entityId: receipt.id,
      action: 'PAYMENT_VOIDED',
      before: { status: receipt.status, amount: receipt.amount },
      after: { status: 'VOIDED', voidedAt: now, voidReason: input.reason },
    });
    return { orderId: receipt.orderId };
  });
}
