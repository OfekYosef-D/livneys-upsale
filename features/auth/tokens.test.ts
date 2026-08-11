import { AuthTokenType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateMany = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const findUnique = vi.hoisted(() => vi.fn());
const userUpdate = vi.hoisted(() => vi.fn());
const userFindUnique = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn(async (callback: (tx: unknown) => unknown) => callback({
  authToken: { updateMany, create, findUnique },
  user: { update: userUpdate, findUnique: userFindUnique },
})));
vi.mock('../../lib/db', () => ({ prisma: { $transaction: transaction, authToken: { findUnique } } }));

const { assertPasswordTokenUsable, consumePasswordToken, issueAuthToken, InvalidAuthTokenError } = await import('./tokens');

describe('one-time password tokens', () => {
  beforeEach(() => {
    updateMany.mockReset(); create.mockReset(); findUnique.mockReset(); userUpdate.mockReset(); userFindUnique.mockReset(); transaction.mockClear();
    userFindUnique.mockResolvedValue({
      id: 'user-1', sessionVersion: 3, isActive: true, role: 'CUSTOMER', passwordHash: null, customer: { isActive: true },
    });
  });

  it('persists only a hash and gives setup links a 24-hour expiry', async () => {
    create.mockImplementation(async ({ data }) => ({ id: 'token-1', ...data }));
    const now = new Date('2026-08-11T12:00:00.000Z');
    const result = await issueAuthToken({ userId: 'user-1', type: AuthTokenType.PASSWORD_SETUP, baseUrl: 'https://example.com', now });
    const persisted = create.mock.calls[0][0].data;
    expect(persisted.sessionVersion).toBe(3);
    expect(persisted.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted.tokenHash).not.toBe(result.rawToken);
    expect(JSON.stringify(persisted)).not.toContain(result.rawToken);
    expect(result.url).toBe(`https://example.com/setup-password?token=${result.rawToken}`);
    expect(result.expiresAt).toEqual(new Date('2026-08-12T12:00:00.000Z'));
  });

  it('does not issue a token after the account has been deactivated', async () => {
    userFindUnique.mockResolvedValue({
      id: 'user-1', sessionVersion: 4, isActive: false, role: 'CUSTOMER', customer: { isActive: true },
    });

    await expect(issueAuthToken({
      userId: 'user-1', type: AuthTokenType.PASSWORD_RESET, baseUrl: 'https://example.com',
    })).rejects.toBeInstanceOf(InvalidAuthTokenError);
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps concurrent reset links valid until one of them changes the password', async () => {
    create.mockImplementation(async ({ data }) => ({ id: 'reset-token-2', ...data }));

    await issueAuthToken({
      userId: 'user-1',
      type: AuthTokenType.PASSWORD_RESET,
      baseUrl: 'https://example.com',
    });

    expect(updateMany).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: AuthTokenType.PASSWORD_RESET }),
    }));
  });

  it('does not issue a setup token after the user has already set a password', async () => {
    userFindUnique.mockResolvedValue({
      id: 'user-1', sessionVersion: 4, isActive: true, role: 'CUSTOMER', passwordHash: 'existing-hash', customer: { isActive: true },
    });

    await expect(issueAuthToken({
      userId: 'user-1', type: AuthTokenType.PASSWORD_SETUP, baseUrl: 'https://example.com',
    })).rejects.toBeInstanceOf(InvalidAuthTokenError);
    expect(create).not.toHaveBeenCalled();
  });

  it('claims a valid token once and revokes all existing sessions', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    findUnique.mockResolvedValue({
      id: 'token-1', userId: 'user-1', type: AuthTokenType.PASSWORD_RESET, usedAt: null,
      expiresAt: new Date('2026-08-11T12:20:00.000Z'),
      sessionVersion: 3,
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-1', isActive: true, sessionVersion: 3, customer: { isActive: true } },
    });
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(consumePasswordToken({ token: 'raw-token', type: AuthTokenType.PASSWORD_RESET, passwordHash: 'new-hash', now })).resolves.toMatchObject({ userId: 'user-1' });
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sessionVersion: { increment: 1 }, passwordHash: 'new-hash' }) }));
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user-1', usedAt: null },
      data: { usedAt: now },
    });
  });

  it('cheaply validates token eligibility before password hashing starts', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    findUnique.mockResolvedValue({
      id: 'token-1', userId: 'user-1', type: AuthTokenType.PASSWORD_RESET, usedAt: null,
      expiresAt: new Date('2026-08-11T12:20:00.000Z'),
      sessionVersion: 3,
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-1', isActive: true, sessionVersion: 3, customer: { isActive: true } },
    });

    await expect(assertPasswordTokenUsable({
      token: 'raw-token', type: AuthTokenType.PASSWORD_RESET, now,
    })).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    }));
  });

  it('rejects expired or already used tokens without changing a password', async () => {
    findUnique.mockResolvedValue({
      id: 'token-1', userId: 'user-1', type: AuthTokenType.PASSWORD_RESET, usedAt: new Date(),
      expiresAt: new Date('2026-08-11T11:00:00.000Z'),
      sessionVersion: 3,
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-1', isActive: true, sessionVersion: 3, customer: { isActive: true } },
    });
    await expect(consumePasswordToken({ token: 'used', type: AuthTokenType.PASSWORD_RESET, passwordHash: 'new', now: new Date('2026-08-11T12:00:00.000Z') })).rejects.toBeInstanceOf(InvalidAuthTokenError);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('rejects a token issued before the account session version changed', async () => {
    findUnique.mockResolvedValue({
      id: 'token-1', userId: 'user-1', type: AuthTokenType.PASSWORD_RESET, usedAt: null,
      expiresAt: new Date('2026-08-11T12:20:00.000Z'), sessionVersion: 3,
      user: { id: 'user-1', role: 'CUSTOMER', customerId: 'cust-1', isActive: true, sessionVersion: 5, customer: { isActive: true } },
    });

    await expect(consumePasswordToken({
      token: 'revoked-by-version', type: AuthTokenType.PASSWORD_RESET, passwordHash: 'new', now: new Date('2026-08-11T12:00:00.000Z'),
    })).rejects.toBeInstanceOf(InvalidAuthTokenError);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
