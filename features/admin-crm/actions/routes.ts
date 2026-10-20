'use server';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { createEntityId } from '@/lib/ids';
import { adminAction } from '@/lib/server-action';
import { buildRouteAnchor, resolveRouteSchedule } from '../../routes/schedule';
import { activeToggleSchema, routeSchema } from '../schemas';

export const saveRouteAction = adminAction(routeSchema, async ({ id, nextDeliveryDate, ...data }, ctx) => {
  return prisma.$transaction(async (tx) => {
    const before = id ? await tx.route.findUnique({ where: { id } }) : null;
    if (id && !before) throw new NotFoundError('הקו לא נמצא.');

    const schedule = buildRouteAnchor({
      deliveryWeekday: data.deliveryWeekday,
      cutoffWeekday: data.cutoffWeekday,
      cutoffTime: data.cutoffTime,
      nextDeliveryDate,
      // Compare with the week customers are ordering for now, even if the stored anchor is stale.
      currentAnchor: before ? resolveRouteSchedule(before).deliveryAt : null,
    });
    const routeId = id ?? createEntityId('route');
    if (id) await tx.route.update({ where: { id }, data: { ...data, ...schedule } });
    else await tx.route.create({ data: { ...data, ...schedule, id: routeId } });

    await ctx.audit(tx, {
      entityType: 'Route',
      entityId: routeId,
      action: id ? 'ROUTE_UPDATED' : 'ROUTE_CREATED',
      before: before ?? undefined,
      after: { ...data, ...schedule },
    });
    return { routeId };
  });
});

export const toggleRouteActiveAction = adminAction(activeToggleSchema, async ({ id, isActive }, ctx) => {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.route.findUnique({ where: { id }, select: { isActive: true } });
    if (!existing) throw new NotFoundError('הקו לא נמצא.');
    await tx.route.update({ where: { id }, data: { isActive } });
    await ctx.audit(tx, { entityType: 'Route', entityId: id, action: isActive ? 'ROUTE_ACTIVATED' : 'ROUTE_DEACTIVATED', before: existing, after: { isActive } });
  });
  return { routeId: id };
});
