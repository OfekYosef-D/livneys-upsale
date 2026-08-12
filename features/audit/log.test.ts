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
});
