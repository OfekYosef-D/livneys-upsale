import { beforeEach, describe, expect, it, vi } from 'vitest';

const userFindUnique = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const compare = vi.hoisted(() => vi.fn());
const hash = vi.hoisted(() => vi.fn());
const assertPasswordTokenUsable = vi.hoisted(() => vi.fn());
const after = vi.hoisted(() => vi.fn());
const issueAuthToken = vi.hoisted(() => vi.fn());
const assertAccountAccessDeliveryConfigured = vi.hoisted(() => vi.fn());
const sendAccountAccessNotifications = vi.hoisted(() => vi.fn());

vi.mock('bcryptjs', () => ({ default: { compare, hash } }));
vi.mock('next/server', () => ({ after }));
vi.mock('@/lib/action-result', () => ({
  actionOk: (data: unknown) => ({ ok: true, data }),
  actionError: (error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
}));
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: userFindUnique } } }));
vi.mock('@/lib/authorization', () => ({ assertAdminAction: vi.fn(), assertAdminEnrollmentAction: vi.fn() }));
vi.mock('./request', () => ({
  getRequestIp: vi.fn(async () => '203.0.113.7'),
  getRequestBaseUrl: vi.fn(async () => 'https://example.com'),
}));
vi.mock('./rate-limit', () => ({ consumeRateLimit }));
vi.mock('./tokens', () => ({
  assertPasswordTokenUsable,
  consumePasswordToken: vi.fn(),
  issueAuthToken,
  issueAuthTokenInTransaction: vi.fn(),
}));
vi.mock('./notifications', () => ({
  assertAccountAccessDeliveryConfigured,
  sendAccountAccessNotifications,
}));
vi.mock('./mfa', () => ({
  encryptMfaSecret: vi.fn(), generateMfaSecret: vi.fn(), generateRecoveryCodes: vi.fn(),
  hashRecoveryCode: vi.fn(), verifyTotpCode: vi.fn(),
}));

const { requestPasswordResetAction } = await import('./actions');

describe('password reset actions', () => {
  beforeEach(() => {
    userFindUnique.mockReset();
    consumeRateLimit.mockReset();
    compare.mockReset();
    hash.mockReset();
    assertPasswordTokenUsable.mockReset();
    after.mockReset();
    issueAuthToken.mockReset();
    assertAccountAccessDeliveryConfigured.mockReset();
    sendAccountAccessNotifications.mockReset();
    userFindUnique.mockResolvedValue(null);
    compare.mockResolvedValue(false);
    assertAccountAccessDeliveryConfigured.mockImplementation(() => { throw new Error('not configured'); });
  });

  it('limits password reset independently by IP and normalized account', async () => {
    await expect(requestPasswordResetAction({ email: 'Buyer@Example.com' })).resolves.toMatchObject({ ok: true });

    expect(consumeRateLimit).toHaveBeenNthCalledWith(1, expect.objectContaining({
      scope: 'password-reset-ip', identifier: '203.0.113.7', limit: 20,
    }));
    expect(consumeRateLimit).toHaveBeenNthCalledWith(2, expect.objectContaining({
      scope: 'password-reset-account', identifier: 'buyer@example.com', limit: 4,
    }));
  });

  it('defers reset email delivery and applies the same timing padding for an active account', async () => {
    assertAccountAccessDeliveryConfigured.mockReset();
    userFindUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      role: 'CUSTOMER',
      customer: { isActive: true },
    });
    issueAuthToken.mockResolvedValue({ url: 'https://example.com/set-password?token=secret' });

    await expect(requestPasswordResetAction({ email: 'buyer@example.com' })).resolves.toMatchObject({ ok: true });

    expect(issueAuthToken).toHaveBeenCalledOnce();
    expect(compare).toHaveBeenCalledWith('password-reset-timing-pad', expect.any(String));
    expect(sendAccountAccessNotifications).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledOnce();

    await after.mock.calls[0][0]();
    expect(sendAccountAccessNotifications).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'PASSWORD_RESET',
      url: 'https://example.com/set-password?token=secret',
    });
  });

  it('rejects an unusable token before running the expensive password hash', async () => {
    assertPasswordTokenUsable.mockRejectedValueOnce(new Error('invalid token'));

    const { setPasswordWithTokenAction } = await import('./actions');
    await expect(setPasswordWithTokenAction({
      token: 'x'.repeat(64),
      password: 'Strong-New-Password-2026!',
      passwordConfirmation: 'Strong-New-Password-2026!',
      type: 'reset',
    })).resolves.toEqual({ ok: false, error: 'invalid token' });
    expect(hash).not.toHaveBeenCalled();
  });
});
