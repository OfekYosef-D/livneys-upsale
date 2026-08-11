import { describe, expect, it, vi } from 'vitest';
import { revokeCustomerSessionsOnDeactivation } from './customer-access';

describe('customer activation access', () => {
  it('revokes every company session on an active to inactive transition', async () => {
    const updateMany = vi.fn();

    await revokeCustomerSessionsOnDeactivation(
      { user: { updateMany } } as never,
      { customerId: 'customer-1', wasActive: true, isActive: false },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { customerId: 'customer-1' },
      data: { sessionVersion: { increment: 1 } },
    });
  });

  it('does not revoke sessions when the company remains active or inactive', async () => {
    const updateMany = vi.fn();
    const tx = { user: { updateMany } } as never;

    await revokeCustomerSessionsOnDeactivation(tx, { customerId: 'customer-1', wasActive: true, isActive: true });
    await revokeCustomerSessionsOnDeactivation(tx, { customerId: 'customer-1', wasActive: false, isActive: false });

    expect(updateMany).not.toHaveBeenCalled();
  });
});
