'use server';

import { revalidatePath } from 'next/cache';
import { actionError, actionOk, type ActionResult } from '../../lib/action-result';
import { assertAdminAction } from '../../lib/authorization';
import { recordPaymentReceipt, voidPaymentReceipt } from './service';
import { recordPaymentReceiptSchema, voidPaymentReceiptSchema } from './schemas';

export async function recordPaymentReceiptAction(input: unknown): Promise<ActionResult<{ receiptId: string; replayed: boolean }>> {
  try {
    const parsed = recordPaymentReceiptSchema.parse(input);
    const session = await assertAdminAction();
    const result = await recordPaymentReceipt({
      ...parsed,
      reference: parsed.reference ?? null,
      note: parsed.note ?? null,
      actorUserId: session.user.id,
    });
    revalidateOrderPaths(parsed.orderId);
    return actionOk(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function voidPaymentReceiptAction(input: unknown): Promise<ActionResult<{ orderId: string }>> {
  try {
    const parsed = voidPaymentReceiptSchema.parse(input);
    const session = await assertAdminAction();
    const result = await voidPaymentReceipt({
      receiptId: parsed.receiptId,
      reason: parsed.reason,
      actorUserId: session.user.id,
    });
    revalidateOrderPaths(parsed.orderId);
    return actionOk(result);
  } catch (error) {
    return actionError(error);
  }
}

function revalidateOrderPaths(orderId: string) {
  revalidatePath('/admin');
  revalidatePath(`/admin/orders/${orderId}`);
}
