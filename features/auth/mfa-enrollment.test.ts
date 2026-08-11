import { beforeEach, describe, expect, it, vi } from 'vitest';

const userFindUnique = vi.hoisted(() => vi.fn());
const userUpdate = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const assertAdminEnrollmentAction = vi.hoisted(() => vi.fn());
const encryptMfaSecret = vi.hoisted(() => vi.fn());
const decryptMfaSecret = vi.hoisted(() => vi.fn());
const generateMfaSecret = vi.hoisted(() => vi.fn());
const generateRecoveryCodes = vi.hoisted(() => vi.fn());
const hashRecoveryCode = vi.hoisted(() => vi.fn());
const verifyTotpCode = vi.hoisted(() => vi.fn());
const comparePassword = vi.hoisted(() => vi.fn());

vi.mock('bcryptjs', () => ({ default: { compare: comparePassword, hash: vi.fn() } }));

vi.mock('@/lib/action-result', () => ({
  actionOk: (data: unknown) => ({ ok: true, data }),
  actionError: (error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
}));
vi.mock('@/lib/authorization', () => ({ assertAdminAction: vi.fn(), assertAdminEnrollmentAction }));
vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: userFindUnique, update: userUpdate }, $transaction: transaction },
}));
vi.mock('./request', () => ({ getRequestIp: vi.fn(), getRequestBaseUrl: vi.fn() }));
vi.mock('./rate-limit', () => ({ consumeRateLimit: vi.fn() }));
vi.mock('./tokens', () => ({
  assertPasswordTokenUsable: vi.fn(), consumePasswordToken: vi.fn(), issueAuthToken: vi.fn(), issueAuthTokenInTransaction: vi.fn(),
}));
vi.mock('./notifications', () => ({
  assertAccountAccessDeliveryConfigured: vi.fn(), sendAccountAccessNotifications: vi.fn(),
}));
vi.mock('./mfa', () => ({
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotpCode,
}));

const { confirmMfaEnrollmentAction, startMfaEnrollmentAction } = await import('./actions');

describe('MFA re-enrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertAdminEnrollmentAction.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    generateMfaSecret.mockReturnValue('NEWSECRET');
    encryptMfaSecret.mockReturnValue('encrypted-new');
    userFindUnique.mockResolvedValue({
      id: 'admin-1', role: 'ADMIN', isActive: true, mfaEnabled: false, passwordHash: 'password-hash',
    });
  });

  it('requires the current password before replacing an active factor', async () => {
    userFindUnique.mockResolvedValue({
      id: 'admin-1', role: 'ADMIN', isActive: true, mfaEnabled: true, passwordHash: 'password-hash',
    });
    comparePassword.mockResolvedValue(false);

    await expect(startMfaEnrollmentAction({ intent: 'start', password: 'wrong-password' })).resolves.toMatchObject({ ok: false });

    expect(comparePassword).toHaveBeenCalledWith('wrong-password', 'password-hash');
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('allows password-verified repair when the current authenticator is unavailable', async () => {
    userFindUnique.mockResolvedValue({
      id: 'admin-1', role: 'ADMIN', isActive: true, mfaEnabled: true, passwordHash: 'password-hash',
    });
    comparePassword.mockResolvedValue(true);
    userUpdate.mockResolvedValue({});

    await expect(startMfaEnrollmentAction({ intent: 'start', password: 'current-password' })).resolves.toMatchObject({ ok: true });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { mfaPendingSecretEncrypted: 'encrypted-new' },
    });
  });

  it('stores a replacement secret as pending without disabling the active factor', async () => {
    userUpdate.mockResolvedValue({});

    await expect(startMfaEnrollmentAction({ intent: 'start' })).resolves.toMatchObject({ ok: true });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { mfaPendingSecretEncrypted: 'encrypted-new' },
    });
  });

  it('atomically activates the verified pending secret and replaces recovery codes', async () => {
    userFindUnique.mockResolvedValue({ id: 'admin-1', mfaPendingSecretEncrypted: 'encrypted-new' });
    decryptMfaSecret.mockReturnValue('NEWSECRET');
    verifyTotpCode.mockReturnValue(true);
    generateRecoveryCodes.mockReturnValue(['recover-1', 'recover-2']);
    hashRecoveryCode.mockImplementation((code: string) => `hash:${code}`);
    const tx = {
      mfaRecoveryCode: { deleteMany: vi.fn(), createMany: vi.fn() },
      user: { update: vi.fn() },
    };
    transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(confirmMfaEnrollmentAction({ code: '123456' })).resolves.toEqual({
      ok: true,
      data: { recoveryCodes: ['recover-1', 'recover-2'] },
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: {
        mfaEnabled: true,
        mfaSecretEncrypted: 'encrypted-new',
        mfaPendingSecretEncrypted: null,
        sessionVersion: { increment: 1 },
      },
    });
  });
});
