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
const userFindUnique = vi.hoisted(() => vi.fn());

vi.mock('./db', () => ({
  prisma: { user: { findUnique: userFindUnique } },
}));

describe('authorization helpers', () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset();
    userFindUnique.mockReset();
    userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === 'user-admin'
      ? { id: 'user-admin', role: 'ADMIN', customerId: null, isActive: true, sessionVersion: 1, mfaEnabled: true, customer: null }
      : { id: 'user-cust-001', role: 'CUSTOMER', customerId: 'cust-001', isActive: true, sessionVersion: 1, mfaEnabled: false, customer: { id: 'cust-001', isActive: true } });
  });

  it('allows a customer action only for the logged-in customer account', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: {
        id: 'user-cust-001',
        role: 'CUSTOMER',
        customerId: 'cust-001',
        sessionVersion: 1,
        mfaEnabled: false,
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
        sessionVersion: 1,
        mfaEnabled: false,
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
        sessionVersion: 1,
        mfaEnabled: true,
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
        sessionVersion: 1,
        mfaEnabled: true,
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
        sessionVersion: 1,
        mfaEnabled: false,
      },
      expires: '2026-06-27T00:00:00.000Z',
    });

    await expect(assertAdminAction()).rejects.toThrow(AuthorizationError);
  });

  it('allows admin actions without MFA enrollment because two-factor auth is optional', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: {
        id: 'user-admin',
        role: 'ADMIN',
        customerId: null,
        sessionVersion: 1,
        mfaEnabled: false,
      },
      expires: '2026-06-27T00:00:00.000Z',
    });
    userFindUnique.mockResolvedValue({
      id: 'user-admin', role: 'ADMIN', customerId: null, isActive: true, sessionVersion: 1, mfaEnabled: false, customer: null,
    });

    await expect(assertAdminAction()).resolves.toMatchObject({
      user: { role: 'ADMIN', mfaEnabled: false },
    });
  });

  it('rejects a stale session after the user session version changes', async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: 'user-cust-001', role: 'CUSTOMER', customerId: 'cust-001', sessionVersion: 1, mfaEnabled: false },
      expires: '2026-06-27T00:00:00.000Z',
    });
    userFindUnique.mockResolvedValue({
      id: 'user-cust-001', role: 'CUSTOMER', customerId: 'cust-001', isActive: true, sessionVersion: 2, mfaEnabled: false,
      customer: { id: 'cust-001', isActive: true },
    });

    await expect(assertCustomerAction('cust-001')).rejects.toThrow(AuthorizationError);
  });
});
