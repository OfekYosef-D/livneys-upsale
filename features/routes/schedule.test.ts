import { describe, expect, it } from 'vitest';
import { getZonedParts, zonedTimeToUtc } from '@/lib/datetime';
import { buildRouteAnchor, computeCutoff, computeNextDelivery, resolveRouteSchedule } from './schedule';

const israel = (year: number, month: number, day: number, hour = 0, minute = 0) => zonedTimeToUtc({ year, month, day, hour, minute });

// Tuesday deliveries at 08:00, orders close Sunday 18:00.
const route = {
  deliveryWeekday: 2,
  cutoffWeekday: 0,
  cutoffTime: '18:00',
  nextDeliveryAt: israel(2026, 10, 13, 8),
  nextCutoffAt: israel(2026, 10, 11, 18),
};

describe('route schedule', () => {
  it('uses the stored schedule while the delivery is still ahead', () => {
    const now = israel(2026, 10, 12, 9);
    expect(resolveRouteSchedule(route, now)).toEqual({ deliveryAt: route.nextDeliveryAt, cutoffAt: route.nextCutoffAt });
  });

  it('rolls to next week once the delivery has started, so the portal never gets stuck', () => {
    const now = israel(2026, 10, 13, 9);
    const schedule = resolveRouteSchedule(route, now);
    expect(getZonedParts(schedule.deliveryAt)).toMatchObject({ month: 10, day: 20, hour: 8, weekday: 2 });
    expect(getZonedParts(schedule.cutoffAt)).toMatchObject({ month: 10, day: 18, hour: 18, weekday: 0 });
  });

  it('skips several missed weeks at once and keeps 08:00 Israeli time across the DST change', () => {
    const now = israel(2026, 11, 5, 12);
    const schedule = resolveRouteSchedule(route, now);
    expect(getZonedParts(schedule.deliveryAt)).toMatchObject({ month: 11, day: 10, hour: 8, weekday: 2 });
    expect(schedule.deliveryAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it('computes the cut-off as the last configured weekday/time strictly before the delivery', () => {
    const delivery = israel(2026, 10, 20, 8);
    expect(getZonedParts(computeCutoff(delivery, 0, '18:00'))).toMatchObject({ day: 18, hour: 18 });
    // Same-day cut-off after the delivery time belongs to the previous week.
    expect(getZonedParts(computeCutoff(delivery, 2, '10:00'))).toMatchObject({ day: 13, hour: 10 });
    expect(getZonedParts(computeCutoff(delivery, 2, '06:00'))).toMatchObject({ day: 20, hour: 6 });
  });

  it('finds the next delivery weekday in the future', () => {
    const now = israel(2026, 10, 20, 9); // Tuesday after 08:00
    expect(getZonedParts(computeNextDelivery(2, now))).toMatchObject({ day: 27, hour: 8 });
    expect(getZonedParts(computeNextDelivery(3, now))).toMatchObject({ day: 21, hour: 8 });
  });

  it('builds the anchor from an explicit holiday date and keeps an unchanged anchor stable', () => {
    const now = israel(2026, 10, 19, 12);
    const moved = buildRouteAnchor({ deliveryWeekday: 2, cutoffWeekday: 0, cutoffTime: '18:00', nextDeliveryDate: '2026-10-22', now });
    expect(getZonedParts(moved.nextDeliveryAt)).toMatchObject({ day: 22, hour: 8 });
    expect(getZonedParts(moved.nextCutoffAt)).toMatchObject({ day: 18, hour: 18 });

    const currentAnchor = israel(2026, 10, 20, 3); // legacy time of day
    const unchanged = buildRouteAnchor({ deliveryWeekday: 2, cutoffWeekday: 0, cutoffTime: '17:00', currentAnchor, now });
    expect(unchanged.nextDeliveryAt).toBe(currentAnchor);
    expect(getZonedParts(unchanged.nextCutoffAt)).toMatchObject({ day: 18, hour: 17 });
  });
});
