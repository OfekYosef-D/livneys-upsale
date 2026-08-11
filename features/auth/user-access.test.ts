import { describe, expect, it, vi } from 'vitest';
import { updateCustomerUserAccess } from './user-access';

describe('customer user access changes', () => {
  it('revokes sessions and outstanding password links when disabling a user', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const consumeTokens = vi.fn();
    const now = new Date('2026-08-11T20:00:00.000Z');

    await updateCustomerUserAccess(
      { user: { updateMany }, authToken: { updateMany: consumeTokens } } as never,
      { customerId: 'customer-1', userId: 'user-1', isActive: false, now },
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', customerId: 'customer-1', role: 'CUSTOMER' },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });
    expect(consumeTokens).toHaveBeenCalledWith({
      where: { userId: 'user-1', usedAt: null },
      data: { usedAt: now },
    });
  });

  it('does not consume password links when re-enabling a user', async () => {
    const consumeTokens = vi.fn();
    await updateCustomerUserAccess(
      { user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, authToken: { updateMany: consumeTokens } } as never,
      { customerId: 'customer-1', userId: 'user-1', isActive: true, now: new Date() },
    );
    expect(consumeTokens).not.toHaveBeenCalled();
  });
});
