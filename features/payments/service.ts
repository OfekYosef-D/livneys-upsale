import { randomUUID } from 'node:crypto';
import { Prisma, type PaymentMethod } from '@prisma/client';
import { prisma } from '../../lib/db';
import { SafeActionError } from '../../lib/safe-action-error';
import { appendAuditLog } from '../audit/log';

type ReceiptLike = { amount: unknown; status: 'RECORDED' | 'VOIDED' };

type PaymentTransactionClient = Pick<Prisma.TransactionClient, 'order' | 'paymentReceipt' | 'auditLog'>;

export type RecordPaymentReceiptInput = {
  orderId: string;
  idempotencyKey: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  receivedAt: Date;
  note: string | null;
  actorUserId: string;
};

export type VoidPaymentReceiptInput = {
  receiptId: string;
  reason: string;
  actorUserId: string;
  now?: Date;
};

export function getPaymentSummary(totalIncludingVat: number, receipts: ReceiptLike[]) {
  const paidTotal = roundCurrency(receipts
    .filter((receipt) => receipt.status === 'RECORDED')
    .reduce((sum, receipt) => sum + Number(receipt.amount), 0));
  const outstanding = roundCurrency(Math.max(0, totalIncludingVat - paidTotal));
  const status = paidTotal <= 0 ? 'UNPAID' : outstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
  return { status, paidTotal, outstanding } as const;
}

export async function recordPaymentReceipt(input: RecordPaymentReceiptInput) {
  try {
    return await prisma.$transaction(
      (tx) => recordPaymentReceiptInTransaction(tx, input),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replay = await prisma.paymentReceipt.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, orderId: true },
      });
      if (replay?.orderId === input.orderId) return { receiptId: replay.id, replayed: true } as const;
    }
    throw error;
  }
}

export async function recordPaymentReceiptInTransaction(
  tx: PaymentTransactionClient,
  input: RecordPaymentReceiptInput,
) {
    const existingReceipt = await tx.paymentReceipt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, orderId: true },
    });
    if (existingReceipt) {
      if (existingReceipt.orderId !== input.orderId) {
        throw new SafeActionError('IDEMPOTENCY_CONFLICT', '׳”׳‘׳§׳©׳” ׳›׳‘׳¨ ׳©׳•׳™׳›׳” ׳׳×׳§׳‘׳•׳ ׳׳—׳¨. ׳¨׳¢׳ ׳ ׳• ׳׳× ׳”׳׳¡׳ ׳•׳ ׳¡׳• ׳©׳•׳‘.');
      }
      return { receiptId: existingReceipt.id, replayed: true } as const;
    }

    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        customerId: true,
        orderNumber: true,
        status: true,
        totalIncludingVat: true,
        paymentReceipts: { select: { amount: true, status: true } },
      },
    });
    if (!order) throw new SafeActionError('NOT_FOUND', 'ההזמנה לא נמצאה.');
    if (order.status === 'DRAFT' || order.status === 'CANCELLED') {
      throw new SafeActionError('ORDER_LOCKED', 'לא ניתן לרשום תקבול להזמנה במצב זה.');
    }

    const summary = getPaymentSummary(Number(order.totalIncludingVat), order.paymentReceipts);
    if (input.amount > summary.outstanding + 0.001) {
      throw new SafeActionError(
        'PAYMENT_EXCEEDS_BALANCE',
        'סכום התקבול גבוה מהיתרה הפתוחה בהזמנה.',
        { outstanding: summary.outstanding },
      );
    }

    const receipt = await tx.paymentReceipt.create({
      data: {
        orderId: input.orderId,
        idempotencyKey: input.idempotencyKey,
        amount: input.amount,
        method: input.method,
        reference: normalizeText(input.reference),
        receivedAt: input.receivedAt,
        note: normalizeText(input.note),
        status: 'RECORDED',
        recordedByUserId: input.actorUserId,
      },
      select: { id: true },
    });
    await appendAuditLog(tx, {
      actorUserId: input.actorUserId,
      actorRole: 'ADMIN',
      customerId: order.customerId,
      entityType: 'PaymentReceipt',
      entityId: receipt.id,
      action: 'PAYMENT_RECORDED',
      requestId: randomUUID(),
      after: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: input.amount,
        method: input.method,
        reference: normalizeText(input.reference),
        receivedAt: input.receivedAt,
      },
    });
  return { receiptId: receipt.id, replayed: false } as const;
}

export async function voidPaymentReceipt(input: VoidPaymentReceiptInput) {
  return prisma.$transaction(
    (tx) => voidPaymentReceiptInTransaction(tx, input),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function voidPaymentReceiptInTransaction(
  tx: PaymentTransactionClient,
  input: VoidPaymentReceiptInput,
) {
  const reason = input.reason.trim();
  if (!reason) throw new SafeActionError('VALIDATION_ERROR', 'יש להזין סיבת ביטול לתקבול.');
  const now = input.now ?? new Date();

    const receipt = await tx.paymentReceipt.findUnique({
      where: { id: input.receiptId },
      select: {
        id: true,
        orderId: true,
        amount: true,
        status: true,
        order: { select: { customerId: true } },
      },
    });
    if (!receipt) throw new SafeActionError('NOT_FOUND', 'התקבול לא נמצא.');

    const changed = await tx.paymentReceipt.updateMany({
      where: { id: receipt.id, status: 'RECORDED' },
      data: {
        status: 'VOIDED',
        voidedAt: now,
        voidedByUserId: input.actorUserId,
        voidReason: reason,
      },
    });
    if (changed.count !== 1) throw new SafeActionError('STALE_VERSION', 'התקבול כבר בוטל או השתנה. רעננו את המסך.');

    await appendAuditLog(tx, {
      actorUserId: input.actorUserId,
      actorRole: 'ADMIN',
      customerId: receipt.order.customerId,
      entityType: 'PaymentReceipt',
      entityId: receipt.id,
      action: 'PAYMENT_VOIDED',
      requestId: randomUUID(),
      before: { status: receipt.status, amount: receipt.amount },
      after: { status: 'VOIDED', voidedAt: now, voidReason: reason },
    });
  return { orderId: receipt.orderId };
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
