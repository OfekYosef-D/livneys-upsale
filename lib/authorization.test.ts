import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServerSession } from 'next-auth';
import { assertAdminAction, assertCustomerAction, AuthorizationError } from './authorization';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

const mockedGetServerSession = vi.mocked(getServerSession);

describe('authorization helpers', () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset();
  });

  it('allows a customer action only for the logged-in customer account', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: {
        id: 'user-cust-001',
        role: 'CUSTOMER',
        customerId: 'cust-001',
      },
      expires: '2026-06-27T00:00:00.000Z',
    });

    await expect(assertCustomerAction('cust-001')).resolves.toMatchObject({
      user: { customerId: 'cust-001' },
    });
  });

  it('rejects customer actions for another customer account', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: {
        id: 'user-cust-001',
        role: 'CUSTOMER',
        customerId: 'cust-001',
      },
      expires: '2026-06-27T00:00:00.000Z',
    });

    await expect(assertCustomerAction('cust-002')).rejects.toThrow(AuthorizationError);
  });

  it('rejects admin sessions for customer-scoped actions', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: {
        id: 'user-admin',
        role: 'ADMIN',
        customerId: null,
      },
      expires: '2026-06-27T00:00:00.000Z',
    });

    await expect(assertCustomerAction('cust-001')).rejects.toThrow(AuthorizationError);
  });

  it('allows admin-scoped actions only for admin sessions', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: {
        id: 'user-admin',
        role: 'ADMIN',
        customerId: null,
      },
      expires: '2026-06-27T00:00:00.000Z',
    });

    await expect(assertAdminAction()).resolves.toMatchObject({
      user: { role: 'ADMIN' },
    });

    mockedGetServerSession.mockResolvedValue({
      user: {
        id: 'user-cust-001',
        role: 'CUSTOMER',
        customerId: 'cust-001',
      },
      expires: '2026-06-27T00:00:00.000Z',
    });

    await expect(assertAdminAction()).rejects.toThrow(AuthorizationError);
  });
});
