'use server';

import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { adminAction } from '@/lib/server-action';
import { lockCustomerAccessState, revokeCustomerSessionsOnDeactivation, syncCustomerLoginIdentity } from '../../auth/user-access';
import { assertCustomerAssignment, createCustomerRecord } from '../../customers/service';
import { activeToggleSchema, customerSchema } from '../schemas';

export const saveCustomerAction = adminAction(customerSchema, async ({ id, ...fields }, ctx) => {
  return prisma.$transaction(async (tx) => {
    if (!id) {
      const customerId = await createCustomerRecord(tx, fields);
      await ctx.audit(tx, { customerId, entityType: 'Customer', entityId: customerId, action: 'CUSTOMER_CREATED', after: fields });
      return { customerId };
    }

    if (!(await lockCustomerAccessState(tx, id))) throw new NotFoundError('הלקוח לא נמצא.');
    const existing = await tx.customer.findUnique({ where: { id }, include: { users: { select: { id: true, email: true } } } });
    if (!existing) throw new NotFoundError('הלקוח לא נמצא.');
    await assertCustomerAssignment(tx, fields.routeId, fields.priceListId);

    const now = new Date();
    await syncCustomerLoginIdentity(tx, {
      currentEmail: existing.email,
      nextEmail: fields.email,
      nextContactName: fields.contact,
      users: existing.users,
      now,
    });

    const { emailEnabled, whatsappEnabled, ...data } = fields;
    await tx.customer.update({
      where: { id },
      data: {
        ...data,
        notificationPreference: {
          upsert: { create: { emailEnabled, whatsappEnabled }, update: { emailEnabled, whatsappEnabled } },
        },
      },
    });
    await revokeCustomerSessionsOnDeactivation(tx, { customerId: id, wasActive: existing.isActive, isActive: fields.isActive, now });
    await ctx.audit(tx, { customerId: id, entityType: 'Customer', entityId: id, action: 'CUSTOMER_UPDATED', before: existing, after: fields });
    return { customerId: id };
  });
});

export const toggleCustomerActiveAction = adminAction(activeToggleSchema, async ({ id, isActive }, ctx) => {
  await prisma.$transaction(async (tx) => {
    const existing = await lockCustomerAccessState(tx, id);
    if (!existing) throw new NotFoundError('הלקוח לא נמצא.');

    await tx.customer.update({ where: { id }, data: { isActive } });
    await revokeCustomerSessionsOnDeactivation(tx, { customerId: id, wasActive: existing.isActive, isActive, now: new Date() });
    await ctx.audit(tx, {
      customerId: id,
      entityType: 'Customer',
      entityId: id,
      action: isActive ? 'CUSTOMER_ACTIVATED' : 'CUSTOMER_DEACTIVATED',
      before: { isActive: existing.isActive },
      after: { isActive },
    });
  });
  return { customerId: id };
});
