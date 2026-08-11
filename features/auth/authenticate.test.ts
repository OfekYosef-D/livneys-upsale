import { beforeEach, describe, expect, it, vi } from 'vitest';

const userFindUnique = vi.hoisted(() => vi.fn());
const recoveryUpdateMany = vi.hoisted(() => vi.fn());
const compare = vi.hoisted(() => vi.fn());
const consume = vi.hoisted(() => vi.fn());
const clear = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: userFindUnique }, mfaRecoveryCode: { updateMany: recoveryUpdateMany } } }));
vi.mock('bcryptjs', () => ({ default: { compare } }));
vi.mock('./rate-limit', () => ({ consumeRateLimit: consume, clearRateLimit: clear }));

const { authenticateCredentials } = await import('./authenticate');

describe('credential authentication', () => {
  beforeEach(() => {
    userFindUnique.mockReset(); recoveryUpdateMany.mockReset(); compare.mockReset(); consume.mockReset(); clear.mockReset();
    compare.mockResolvedValue(true);
  });

  it('authenticates an active customer without exposing company choices', async () => {
    userFindUnique.mockResolvedValue({
      id: 'user-1', email: 'buyer@example.com', name: 'Buyer', passwordHash: 'hash', role: 'CUSTOMER',
      isActive: true, sessionVersion: 3, mfaEnabled: false, mfaSecretEncrypted: null,
      customerId: 'cust-1', customer: { isActive: true },
    });
    await expect(authenticateCredentials({ email: 'BUYER@example.com', password: 'secret' }, { ip: '1.2.3.4' })).resolves.toMatchObject({ id: 'user-1', sessionVersion: 3 });
    expect(consume).toHaveBeenNthCalledWith(1, expect.objectContaining({ scope: 'login-ip', identifier: '1.2.3.4', limit: 40 }));
    expect(consume).toHaveBeenNthCalledWith(2, expect.objectContaining({ scope: 'login-account', identifier: 'buyer@example.com', limit: 8 }));
    expect(clear).toHaveBeenCalledWith('login-ip', '1.2.3.4');
    expect(clear).toHaveBeenCalledWith('login-account', 'buyer@example.com');
  });

  it('performs a dummy password comparison for unknown accounts and returns the same failure', async () => {
    userFindUnique.mockResolvedValue(null);
    await expect(authenticateCredentials({ email: 'missing@example.com', password: 'secret' })).resolves.toBeNull();
    expect(compare).toHaveBeenCalledOnce();
    expect(clear).not.toHaveBeenCalled();
  });

  it('rejects disabled users and inactive customer companies', async () => {
    userFindUnique.mockResolvedValue({
      id: 'user-1', email: 'buyer@example.com', name: 'Buyer', passwordHash: 'hash', role: 'CUSTOMER',
      isActive: true, sessionVersion: 1, mfaEnabled: false, mfaSecretEncrypted: null,
      customerId: 'cust-1', customer: { isActive: false },
    });
    await expect(authenticateCredentials({ email: 'buyer@example.com', password: 'secret' })).resolves.toBeNull();
  });

  it('requires a one-time second factor when administrator MFA is enabled', async () => {
    userFindUnique.mockResolvedValue({
      id: 'admin-1', email: 'admin@example.com', name: 'Admin', passwordHash: 'hash', role: 'ADMIN',
      isActive: true, sessionVersion: 2, mfaEnabled: true, mfaSecretEncrypted: null,
      customerId: null, customer: null,
    });
    recoveryUpdateMany.mockResolvedValue({ count: 1 });
    await expect(authenticateCredentials({ email: 'admin@example.com', password: 'secret', mfaCode: 'ABCDE-FGHIJ' })).resolves.toMatchObject({ id: 'admin-1', mfaEnabled: true });
    recoveryUpdateMany.mockResolvedValue({ count: 0 });
    await expect(authenticateCredentials({ email: 'admin@example.com', password: 'secret', mfaCode: 'wrong' })).resolves.toBeNull();
  });

  it('falls back to a recovery code when the stored TOTP secret cannot be decrypted', async () => {
    userFindUnique.mockResolvedValue({
      id: 'admin-1', email: 'admin@example.com', name: 'Admin', passwordHash: 'hash', role: 'ADMIN',
      isActive: true, sessionVersion: 2, mfaEnabled: true, mfaSecretEncrypted: 'damaged-ciphertext',
      customerId: null, customer: null,
    });
    recoveryUpdateMany.mockResolvedValue({ count: 1 });

    await expect(authenticateCredentials({
      email: 'admin@example.com', password: 'secret', mfaCode: 'ABCDE-FGHIJ',
    })).resolves.toMatchObject({ id: 'admin-1', mfaEnabled: true });
    expect(recoveryUpdateMany).toHaveBeenCalledOnce();
  });
});
