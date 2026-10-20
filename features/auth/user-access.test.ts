import { beforeEach, describe, expect, it } from 'vitest';
import { createPrismaMock } from '@/test/prisma-mock';
import {
  lockCustomerAccessState,
  revokeCustomerSessionsOnDeactivation,
  syncCustomerLoginIdentity,
  updateCustomerUserAccess,
} from './user-access';

const tx = createPrismaMock();
const now = new Date('2026-08-11T20:00:00.000Z');

beforeEach(() => tx.$reset());

describe('customer access mutation lock', () => {
  it('takes a row lock before access-affecting customer mutations', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'customer-1', isActive: true }]);

    await expect(lockCustomerAccessState(tx as never, 'customer-1')).resolves.toEqual({ id: 'customer-1', isActive: true });

    const query = tx.$queryRaw.mock.calls[0][0] as { strings: string[]; values: unknown[] };
    expect(query.strings.join('')).toContain('FOR UPDATE');
    expect(query.values).toEqual(['customer-1']);
  });

  it('returns null for an unknown customer', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(lockCustomerAccessState(tx as never, 'missing')).resolves.toBeNull();
  });
});

describe('customer user access changes', () => {
  it('returns a safe not-found error when the user does not belong to the company', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateCustomerUserAccess(tx as never, { customerId: 'customer-1', userId: 'missing', isActive: false, now }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(tx.authToken.updateMany).not.toHaveBeenCalled();
  });

  it('revokes sessions and outstanding password links when disabling a user', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 1 });

    await updateCustomerUserAccess(tx as never, { customerId: 'customer-1', userId: 'user-1', isActive: false, now });

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', customerId: 'customer-1', role: 'CUSTOMER' },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });
    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', usedAt: null },
      data: { usedAt: now },
    });
  });

  it('does not consume password links when re-enabling a user', async () => {
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    await updateCustomerUserAccess(tx as never, { customerId: 'customer-1', userId: 'user-1', isActive: true, now });
    expect(tx.authToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('customer deactivation', () => {
  it('revokes every company session and link on an active to inactive transition', async () => {
    await revokeCustomerSessionsOnDeactivation(tx as never, { customerId: 'customer-1', wasActive: true, isActive: false, now });

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { customerId: 'customer-1' },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: { usedAt: null, user: { customerId: 'customer-1' } },
      data: { usedAt: now },
    });
  });

  it('does not revoke sessions when the company remains active or inactive', async () => {
    await revokeCustomerSessionsOnDeactivation(tx as never, { customerId: 'customer-1', wasActive: true, isActive: true, now });
    await revokeCustomerSessionsOnDeactivation(tx as never, { customerId: 'customer-1', wasActive: false, isActive: false, now });
    await revokeCustomerSessionsOnDeactivation(tx as never, { customerId: 'customer-1', wasActive: false, isActive: true, now });

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.authToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('customer login identity synchronization', () => {
  const base = { currentEmail: 'primary@example.com', nextContactName: 'New Contact', now };

  it('does nothing when the email is unchanged', async () => {
    await syncCustomerLoginIdentity(tx as never, {
      ...base, nextEmail: 'primary@example.com', users: [{ id: 'primary', email: 'primary@example.com' }],
    });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('returns a safe validation error when removing an active login email', async () => {
    await expect(syncCustomerLoginIdentity(tx as never, {
      ...base, nextEmail: null, users: [{ id: 'primary', email: 'primary@example.com' }],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('allows clearing an email that is not anyone\'s login', async () => {
    await expect(syncCustomerLoginIdentity(tx as never, { ...base, nextEmail: null, users: [] })).resolves.toBeUndefined();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('uses an existing company user as the contact login without renaming the previous login', async () => {
    await syncCustomerLoginIdentity(tx as never, {
      ...base,
      nextEmail: 'secondary@example.com',
      nextContactName: 'Secondary Contact',
      users: [
        { id: 'primary', email: 'primary@example.com' },
        { id: 'secondary', email: 'secondary@example.com' },
      ],
    });

    expect(tx.user.update).toHaveBeenCalledOnce();
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'secondary' }, data: { name: 'Secondary Contact' } });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('renames the current login and revokes its sessions and open links when the destination email is unused', async () => {
    await syncCustomerLoginIdentity(tx as never, {
      ...base, nextEmail: 'new@example.com', users: [{ id: 'primary', email: 'primary@example.com' }],
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'primary' },
      data: { email: 'new@example.com', name: 'New Contact' },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'primary' },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: { usedAt: null, user: { id: 'primary' } },
      data: { usedAt: now },
    });
  });
});
