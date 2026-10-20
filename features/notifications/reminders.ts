import { prisma } from '@/lib/db';
import { placedOrderStatuses } from '../orders/status';
import { resolveRouteSchedule } from '../routes/schedule';
import type { NotificationConfig } from './channels';
import { getAppBaseUrl } from './config';
import { enqueueNotification } from './jobs';
import { buildReminderContent } from './templates';

const HOUR_MS = 60 * 60 * 1000;
const orderedStatuses = placedOrderStatuses.filter((status) => status !== 'CANCELLED');

/**
 * Weekly re-order reminders. For every active rule (a route, or all routes when unset) and every
 * active customer on that route who has not ordered for the upcoming delivery yet, one reminder is
 * queued once the rule's lead time is reached. Nothing is sent after the cut-off has passed.
 * Idempotent: running it many times a day creates each reminder only once.
 */
export async function generateDueReminders({ now = new Date(), config }: { now?: Date; config?: NotificationConfig } = {}) {
  const [rules, routes] = await Promise.all([
    prisma.reminderRule.findMany({ where: { isActive: true } }),
    prisma.route.findMany({
      where: { isActive: true },
      include: {
        customers: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            contact: true,
            email: true,
            phone: true,
            isActive: true,
            notificationPreference: { select: { emailEnabled: true, whatsappEnabled: true } },
          },
        },
      },
    }),
  ]);

  let queued = 0;
  let skipped = 0;

  for (const route of routes) {
    const routeRules = rules.filter((rule) => !rule.routeId || rule.routeId === route.id);
    if (routeRules.length === 0 || route.customers.length === 0) continue;

    const schedule = resolveRouteSchedule(route, now);
    if (now.getTime() >= schedule.cutoffAt.getTime()) continue;

    const ordered = new Set(
      (await prisma.order.findMany({
        where: {
          customerId: { in: route.customers.map((customer) => customer.id) },
          deliveryWindowStart: schedule.deliveryAt,
          status: { in: orderedStatuses },
        },
        select: { customerId: true },
      })).map((order) => order.customerId),
    );

    for (const rule of routeRules) {
      const sendAt = new Date(schedule.deliveryAt.getTime() - rule.hoursBeforeDelivery * HOUR_MS);
      if (sendAt.getTime() > now.getTime()) continue;

      for (const customer of route.customers) {
        const hasOrder = ordered.has(customer.id);
        const reminderJob = await prisma.reminderJob.upsert({
          where: {
            customerId_routeId_deliveryWindowStart_channel_reminderRuleId: {
              customerId: customer.id,
              routeId: route.id,
              deliveryWindowStart: schedule.deliveryAt,
              channel: rule.channel,
              reminderRuleId: rule.id,
            },
          },
          create: {
            reminderRuleId: rule.id,
            customerId: customer.id,
            routeId: route.id,
            deliveryWindowStart: schedule.deliveryAt,
            channel: rule.channel,
            status: hasOrder ? 'SKIPPED_ORDER_EXISTS' : 'PENDING',
            scheduledAt: sendAt,
          },
          update: {},
        });

        if (hasOrder || reminderJob.status !== 'PENDING') {
          skipped += 1;
          continue;
        }

        const jobIds = await enqueueNotification({
          customerId: customer.id,
          recipient: customer,
          reminderJobId: reminderJob.id,
          channels: [rule.channel],
          dedupeKey: `reminder:${reminderJob.id}`,
          scheduledAt: now,
          config,
          content: buildReminderContent({
            baseUrl: getAppBaseUrl(),
            customer,
            routeName: route.name,
            deliveryAt: schedule.deliveryAt,
            cutoffAt: schedule.cutoffAt,
          }),
        });
        if (jobIds.length > 0) queued += 1;
        else skipped += 1;
      }
    }
  }

  return { queued, skipped };
}
