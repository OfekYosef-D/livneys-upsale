import { beforeEach, describe, expect, it, vi } from 'vitest';

import { asMock } from '@/test/prisma-mock';

const compare = vi.hoisted(() => vi.fn());
const consume = vi.hoisted(() => vi.fn());
const clear = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('bcryptjs', () => ({ default: { compare } }));
vi.mock('./rate-limit', () => ({ consumeRateLimit: consume, clearRateLimit: clear }));

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const userFindUnique = db.user.findUnique;
const recoveryUpdateMany = db.mfaRecoveryCode.updateMany;
const { authenticateCredentials } = await import('./authenticate');

describe('credential authentication', () => {
  beforeEach(() => {
    db.$reset(); compare.mockReset(); consume.mockReset(); clear.mockReset();
    compare.mockResolvedValue(true);
  });

  it('authenticates an active customer without exposing company choices', async () => {
    userFindUnique.mockResolvedValue({
      id: 'user-1', email: 'buyer@example.com', name: 'Buyer', passwordHash: 'hash', role: 'CUSTOMER',
      isActive: true, sessionVersion: 3, mfaEnabled: false, mfaSecretEncrypted: null,
      customerId: 'cust-1', customer: { isActive: true },
    });
    await expect(authenticateCredentials({ email: 'BUYER@example.com', password: 'secret' }, { ip: '1.2.3.4' })).resolves.toMatchObject({ id: 'user-1', sessionVersion: 3 });
    expect(consume).toHaveBeenNthCalledWith(1, 'login-ip', '1.2.3.4', expect.any(Date));
    expect(consume).toHaveBeenNthCalledWith(2, 'login-account', 'buyer@example.com', expect.any(Date));
    expect(clear).toHaveBeenCalledWith('login-account', 'buyer@example.com');
    expect(clear).not.toHaveBeenCalledWith('login-ip', '1.2.3.4');
  });

  it('performs a dummy password comparison for unknown accounts and returns the same failure', async () => {
    userFindUnique.mockResolvedValue(null);
    await expect(authenticateCredentials({ email: 'missing@example.com', password: 'secret' })).resolves.toBeNull();
    expect(compare).toHaveBeenCalledOnce();
    expect(clear).not.toHaveBeenCalled();
  });

  it('rejects bcrypt inputs longer than 72 UTF-8 bytes before querying credentials', async () => {
    await expect(authenticateCredentials({
      email: 'buyer@example.com',
      password: `Aa1!${'א'.repeat(35)}`,
    })).resolves.toBeNull();

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(compare).not.toHaveBeenCalled();
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

  it('rejects an MFA-enabled admin who omits the second factor without burning a recovery code', async () => {
    userFindUnique.mockResolvedValue({
      id: 'admin-1', email: 'admin@example.com', name: 'Admin', passwordHash: 'hash', role: 'ADMIN',
      isActive: true, sessionVersion: 2, mfaEnabled: true, mfaSecretEncrypted: null,
      customerId: null, customer: null,
    });
    await expect(authenticateCredentials({ email: 'admin@example.com', password: 'secret' })).resolves.toBeNull();
    expect(recoveryUpdateMany).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('rejects a wrong password and users without a password yet, keeping the rate-limit counter', async () => {
    const base = {
      id: 'user-1', email: 'buyer@example.com', name: 'Buyer', role: 'CUSTOMER', isActive: true, sessionVersion: 1,
      mfaEnabled: false, mfaSecretEncrypted: null, customerId: 'cust-1', customer: { isActive: true },
    };
    compare.mockResolvedValue(false);
    userFindUnique.mockResolvedValue({ ...base, passwordHash: 'hash' });
    await expect(authenticateCredentials({ email: 'buyer@example.com', password: 'wrong' })).resolves.toBeNull();
    compare.mockResolvedValue(true);
    userFindUnique.mockResolvedValue({ ...base, passwordHash: null });
    await expect(authenticateCredentials({ email: 'buyer@example.com', password: 'anything' })).resolves.toBeNull();
    expect(clear).not.toHaveBeenCalled();
  });

  it('propagates a rate-limit block before checking the password', async () => {
    const { RateLimitError } = await vi.importActual<typeof import('./rate-limit')>('./rate-limit');
    consume.mockRejectedValueOnce(new RateLimitError());
    await expect(authenticateCredentials({ email: 'buyer@example.com', password: 'secret' })).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(compare).not.toHaveBeenCalled();
  });
});
