'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { actionError, actionOk, type ActionResult } from '@/lib/action-result';
import { assertAdminAction } from '@/lib/authorization';
import { prisma } from '@/lib/db';
import { retryNotificationJob, sendNotificationJobNow } from './jobs';

const retryNotificationJobSchema = z.object({
  jobId: z.string().trim().min(1),
});

const updateReminderRuleSchema = z.object({
  ruleId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  hoursBeforeDelivery: z.coerce.number().int().min(1).max(720),
  isActive: z.boolean(),
});

export async function retryNotificationJobAction(input: unknown): Promise<ActionResult<{ jobId: string }>> {
  try {
    const parsed = retryNotificationJobSchema.parse(input);
    await assertAdminAction();
    await retryNotificationJob(parsed.jobId);
    revalidatePath('/admin/notifications');
    return actionOk({ jobId: parsed.jobId });
  } catch (error) {
    return actionError(error);
  }
}

export async function sendNotificationJobNowAction(input: unknown): Promise<ActionResult<{ jobId: string }>> {
  try {
    const parsed = retryNotificationJobSchema.parse(input);
    await assertAdminAction();
    await sendNotificationJobNow(parsed.jobId);
    revalidatePath('/admin/notifications');
    return actionOk({ jobId: parsed.jobId });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateReminderRuleAction(input: unknown): Promise<ActionResult<{ ruleId: string }>> {
  try {
    const parsed = updateReminderRuleSchema.parse(input);
    await assertAdminAction();
    const rule = await prisma.reminderRule.update({
      where: { id: parsed.ruleId },
      data: {
        name: parsed.name,
        hoursBeforeDelivery: parsed.hoursBeforeDelivery,
        isActive: parsed.isActive,
      },
      select: { id: true },
    });
    revalidatePath('/admin/notifications');
    return actionOk({ ruleId: rule.id });
  } catch (error) {
    return actionError(error);
  }
}
