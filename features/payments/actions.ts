'use server';

import { adminAction } from '@/lib/server-action';
import { recordPaymentReceiptSchema, voidPaymentReceiptSchema } from './schemas';
import { recordPaymentReceipt, voidPaymentReceipt } from './service';

export const recordPaymentReceiptAction = adminAction(recordPaymentReceiptSchema, async (input, ctx) =>
  recordPaymentReceipt({ ...input, actorUserId: ctx.actorUserId, audit: ctx.audit }));

export const voidPaymentReceiptAction = adminAction(voidPaymentReceiptSchema, async (input, ctx) =>
  voidPaymentReceipt({ ...input, actorUserId: ctx.actorUserId, audit: ctx.audit }));
