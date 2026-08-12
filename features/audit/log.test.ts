import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { appendAuditLog } from './log';

describe('append-only audit logging', () => {
  it('records actor, entity, request correlation, and redacted snapshots', async () => {
    const create = vi.fn(async (input: unknown) => input);
    const tx = { auditLog: { create } };

    await appendAuditLog(tx as never, {
      actorUserId: 'admin-1',
      actorRole: 'ADMIN',
      customerId: 'cust-1',
      entityType: 'Customer',
      entityId: 'cust-1',
      action: 'CUSTOMER_UPDATED',
      requestId: 'request-1',
      before: { email: 'old@example.com', passwordHash: 'secret-hash' },
      after: { email: 'new@example.com', nested: { accessToken: 'raw-token' } },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        actorRole: 'ADMIN',
        entityType: 'Customer',
        entityId: 'cust-1',
        action: 'CUSTOMER_UPDATED',
        requestId: 'request-1',
        before: { email: 'old@example.com', passwordHash: '[REDACTED]' },
        after: { email: 'new@example.com', nested: { accessToken: '[REDACTED]' } },
      }),
    });
  });

  it('serializes Prisma Decimal values without traversing runtime internals', async () => {
    const create = vi.fn(async (input: unknown) => input);

    await appendAuditLog({ auditLog: { create } } as never, {
      entityType: 'Product',
      entityId: 'product-1',
      action: 'PRODUCT_UPDATED',
      requestId: 'request-2',
      before: { basePrice: new Prisma.Decimal('12.34') },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ before: { basePrice: '12.34' } }),
    });
  });
});
