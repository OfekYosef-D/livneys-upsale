'use server';

import { NotFoundError } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { adminAction } from '@/lib/server-action';
import { fields, z } from '@/lib/validation';
import { resendNotificationJob } from './jobs';

const reminderRuleSchema = z.object({
  name: fields.requiredText(160),
  routeId: fields.optionalText(120),
  channel: z.enum(['EMAIL', 'WHATSAPP']),
  hoursBeforeDelivery: z.coerce.number().int().min(1, 'לפחות שעה אחת.').max(720, 'עד 30 יום.'),
  isActive: z.boolean(),
});

export const sendNotificationJobNowAction = adminAction(z.object({ jobId: fields.id }), async ({ jobId }) => {
  const result = await resendNotificationJob(jobId);
  return { jobId, status: result.processed ? result.status : 'PENDING' };
});

export const createReminderRuleAction = adminAction(reminderRuleSchema, async (input, ctx) => {
  await assertRouteExists(input.routeId);
  return prisma.$transaction(async (tx) => {
    const rule = await tx.reminderRule.create({ data: input, select: { id: true } });
    await ctx.audit(tx, { entityType: 'ReminderRule', entityId: rule.id, action: 'REMINDER_RULE_CREATED', after: input });
    return { ruleId: rule.id };
  });
});

export const updateReminderRuleAction = adminAction(reminderRuleSchema.extend({ ruleId: fields.id }), async ({ ruleId, ...data }, ctx) => {
  await assertRouteExists(data.routeId);
  return prisma.$transaction(async (tx) => {
    const before = await tx.reminderRule.findUnique({ where: { id: ruleId } });
    if (!before) throw new NotFoundError('חוק התזכורת לא נמצא.');
    await tx.reminderRule.update({ where: { id: ruleId }, data });
    await ctx.audit(tx, { entityType: 'ReminderRule', entityId: ruleId, action: 'REMINDER_RULE_UPDATED', before, after: data });
    return { ruleId };
  });
});

async function assertRouteExists(routeId: string | null) {
  if (routeId && !(await prisma.route.findUnique({ where: { id: routeId }, select: { id: true } }))) {
    throw new NotFoundError('הקו לא נמצא.');
  }
}
