import { describe, expect, it, vi } from 'vitest';
import { revokeCustomerSessionsOnDeactivation } from './customer-access';

describe('customer activation access', () => {
  it('revokes every company session on an active to inactive transition', async () => {
    const updateMany = vi.fn();
    const consumeTokens = vi.fn();
    const now = new Date('2026-08-11T20:00:00.000Z');

    await revokeCustomerSessionsOnDeactivation(
      { user: { updateMany }, authToken: { updateMany: consumeTokens } } as never,
      { customerId: 'customer-1', wasActive: true, isActive: false, now },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { customerId: 'customer-1' },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(consumeTokens).toHaveBeenCalledWith({
      where: { usedAt: null, user: { customerId: 'customer-1' } },
      data: { usedAt: now },
    });
  });

  it('does not revoke sessions when the company remains active or inactive', async () => {
    const updateMany = vi.fn();
    const tx = { user: { updateMany }, authToken: { updateMany: vi.fn() } } as never;

    await revokeCustomerSessionsOnDeactivation(tx, { customerId: 'customer-1', wasActive: true, isActive: true, now: new Date() });
    await revokeCustomerSessionsOnDeactivation(tx, { customerId: 'customer-1', wasActive: false, isActive: false, now: new Date() });

    expect(updateMany).not.toHaveBeenCalled();
  });
});
