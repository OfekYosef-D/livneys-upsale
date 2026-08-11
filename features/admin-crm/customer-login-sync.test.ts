import { describe, expect, it, vi } from 'vitest';
import { syncCustomerLoginIdentity } from './customer-login-sync';

describe('customer login identity synchronization', () => {
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
    await syncCustomerLoginIdentity(
      { user: { update } } as never,
      {
        currentEmail: 'primary@example.com',
        nextEmail: 'new@example.com',
        nextContactName: 'New Contact',
        users: [{ id: 'primary', email: 'primary@example.com' }],
      },
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'primary' },
      data: { email: 'new@example.com', name: 'New Contact' },
    });
  });
});
