import { describe, expect, it, vi } from 'vitest';
import { syncCustomerLoginIdentity } from './customer-login-sync';

describe('customer login identity synchronization', () => {
  it('returns a safe validation error when removing an active login email', async () => {
    await expect(syncCustomerLoginIdentity(
      {} as never,
      {
        currentEmail: 'primary@example.com',
        nextEmail: null,
        nextContactName: 'Primary Contact',
        users: [{ id: 'primary', email: 'primary@example.com' }],
        now: new Date('2026-08-12T00:30:00.000Z'),
      },
    )).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('uses an existing company user as the contact login without renaming the previous login', async () => {
    const update = vi.fn();
    await syncCustomerLoginIdentity(
      { user: { update } } as never,
      {
        currentEmail: 'primary@example.com',
        nextEmail: 'secondary@example.com',
        nextContactName: 'Secondary Contact',
        users: [
          { id: 'primary', email: 'primary@example.com' },
          { id: 'secondary', email: 'secondary@example.com' },
        ],
        now: new Date('2026-08-12T00:30:00.000Z'),
      },
    );

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'secondary' },
      data: { name: 'Secondary Contact' },
    });
  });

  it('renames the current login when the destination email is unused', async () => {
    const update = vi.fn();
    const updateMany = vi.fn();
    const now = new Date('2026-08-12T00:30:00.000Z');
    await syncCustomerLoginIdentity(
      { user: { update }, authToken: { updateMany } } as never,
      {
        currentEmail: 'primary@example.com',
        nextEmail: 'new@example.com',
        nextContactName: 'New Contact',
        users: [{ id: 'primary', email: 'primary@example.com' }],
        now,
      },
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'primary' },
      data: { email: 'new@example.com', name: 'New Contact', sessionVersion: { increment: 1 } },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'primary', usedAt: null },
      data: { usedAt: now },
    });
  });
});
