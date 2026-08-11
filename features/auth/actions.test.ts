import { beforeEach, describe, expect, it, vi } from 'vitest';

const userFindUnique = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const compare = vi.hoisted(() => vi.fn());

vi.mock('bcryptjs', () => ({ default: { compare, hash: vi.fn() } }));
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
  consumePasswordToken: vi.fn(),
  issueAuthToken: vi.fn(),
  issueAuthTokenInTransaction: vi.fn(),
}));
vi.mock('./notifications', () => ({
  assertAccountAccessDeliveryConfigured: vi.fn(() => { throw new Error('not configured'); }),
  sendAccountAccessNotifications: vi.fn(),
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
    userFindUnique.mockResolvedValue(null);
    compare.mockResolvedValue(false);
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
});
