import { addZonedDays, getZonedParts, parseIsraelDateTime, zonedTimeToUtc } from '@/lib/datetime';

/**
 * A route delivers once a week. The stored `nextDeliveryAt` is the anchor of that weekly
 * cycle (the admin may move it, e.g. around holidays). Once a delivery has started, the
 * schedule rolls forward by whole weeks in Israeli wall-clock time, so the system never gets
 * stuck on a past delivery even if nobody edits the route.
 */
export type RouteScheduleRules = {
  nextDeliveryAt: Date;
  nextCutoffAt: Date;
  deliveryWeekday: number;
  cutoffWeekday: number;
  /** HH:mm, Israeli time */
  cutoffTime: string;
};

export type RouteSchedule = {
  /** Identifies the weekly delivery window an order belongs to. */
  deliveryAt: Date;
  /** After this moment new orders become special requests. */
  cutoffAt: Date;
};

/** Delivery windows start in the morning; only the date is shown to customers. */
export const DEFAULT_DELIVERY_TIME = { hour: 8, minute: 0 };

export function resolveRouteSchedule(route: RouteScheduleRules, now: Date = new Date()): RouteSchedule {
  if (route.nextDeliveryAt.getTime() > now.getTime()) {
    return { deliveryAt: route.nextDeliveryAt, cutoffAt: route.nextCutoffAt };
  }

  const elapsedWeeks = Math.floor((now.getTime() - route.nextDeliveryAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
  let deliveryAt = addZonedDays(route.nextDeliveryAt, 7 * Math.max(1, elapsedWeeks));
  while (deliveryAt.getTime() <= now.getTime()) deliveryAt = addZonedDays(deliveryAt, 7);

  return { deliveryAt, cutoffAt: computeCutoff(deliveryAt, route.cutoffWeekday, route.cutoffTime) };
}

/** The last cut-off (weekday + time) strictly before the delivery. */
export function computeCutoff(deliveryAt: Date, cutoffWeekday: number, cutoffTime: string): Date {
  const delivery = getZonedParts(deliveryAt);
  const [hour, minute] = parseTime(cutoffTime);
  const daysBefore = (delivery.weekday - cutoffWeekday + 7) % 7;
  const cutoff = zonedTimeToUtc({ year: delivery.year, month: delivery.month, day: delivery.day - daysBefore, hour, minute });
  return cutoff.getTime() < deliveryAt.getTime() ? cutoff : addZonedDays(cutoff, -7);
}

/** The first delivery on `deliveryWeekday` that is still in the future. */
export function computeNextDelivery(deliveryWeekday: number, now: Date = new Date()): Date {
  const today = getZonedParts(now);
  const daysAhead = (deliveryWeekday - today.weekday + 7) % 7;
  const candidate = zonedTimeToUtc({ year: today.year, month: today.month, day: today.day + daysAhead, ...DEFAULT_DELIVERY_TIME });
  return candidate.getTime() > now.getTime() ? candidate : addZonedDays(candidate, 7);
}

/**
 * Builds the stored anchor from the admin form. An explicit date (YYYY-MM-DD) overrides the
 * weekday rule; keeping the current anchor's instant when its date is unchanged preserves the
 * identity of the delivery window that existing orders already belong to.
 */
export function buildRouteAnchor({
  deliveryWeekday,
  cutoffWeekday,
  cutoffTime,
  nextDeliveryDate,
  currentAnchor,
  now = new Date(),
}: {
  deliveryWeekday: number;
  cutoffWeekday: number;
  cutoffTime: string;
  nextDeliveryDate?: string | null;
  currentAnchor?: Date | null;
  now?: Date;
}): { nextDeliveryAt: Date; nextCutoffAt: Date } {
  let nextDeliveryAt = computeNextDelivery(deliveryWeekday, now);

  if (nextDeliveryDate) {
    const explicit = parseIsraelDateTime(nextDeliveryDate);
    if (explicit) {
      const date = getZonedParts(explicit);
      nextDeliveryAt = zonedTimeToUtc({ year: date.year, month: date.month, day: date.day, ...DEFAULT_DELIVERY_TIME });
    }
  }

  if (currentAnchor && sameIsraelDate(currentAnchor, nextDeliveryAt)) nextDeliveryAt = currentAnchor;

  return { nextDeliveryAt, nextCutoffAt: computeCutoff(nextDeliveryAt, cutoffWeekday, cutoffTime) };
}

function sameIsraelDate(a: Date, b: Date): boolean {
  const left = getZonedParts(a);
  const right = getZonedParts(b);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

function parseTime(value: string): [number, number] {
  const [hour = 0, minute = 0] = value.split(':').map(Number);
  return [hour, minute];
}
