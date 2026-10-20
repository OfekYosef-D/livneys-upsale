import { prisma } from '@/lib/db';
import { resolveRouteSchedule } from './schedule';

/**
 * Daily housekeeping: stores the rolled-forward schedule of routes whose delivery has passed.
 * Readers already resolve the schedule on the fly, so this only keeps stored data and admin
 * screens accurate; it is safe to run any number of times.
 */
export async function advanceRouteSchedules(now: Date = new Date()): Promise<{ advanced: number }> {
  const stale = await prisma.route.findMany({ where: { nextDeliveryAt: { lte: now } } });

  for (const route of stale) {
    const schedule = resolveRouteSchedule(route, now);
    await prisma.route.updateMany({
      where: { id: route.id, nextDeliveryAt: route.nextDeliveryAt },
      data: { nextDeliveryAt: schedule.deliveryAt, nextCutoffAt: schedule.cutoffAt },
    });
  }

  return { advanced: stale.length };
}
