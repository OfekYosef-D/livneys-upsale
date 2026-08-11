import { describe, expect, it, vi } from 'vitest';

const userFindFirst = vi.hoisted(() => vi.fn());
const issueAuthToken = vi.hoisted(() => vi.fn());

vi.mock('@/lib/action-result', () => ({
  actionOk: (data: unknown) => ({ ok: true, data }),
  actionError: (error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
}));
vi.mock('@/lib/authorization', () => ({ assertAdminAction: vi.fn(), assertAdminEnrollmentAction: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { user: { findFirst: userFindFirst } } }));
vi.mock('./request', () => ({ getRequestIp: vi.fn(), getRequestBaseUrl: vi.fn(async () => 'https://example.com') }));
vi.mock('./rate-limit', () => ({ consumeRateLimit: vi.fn() }));
vi.mock('./tokens', () => ({
  assertPasswordTokenUsable: vi.fn(), consumePasswordToken: vi.fn(), issueAuthToken, issueAuthTokenInTransaction: vi.fn(),
}));
vi.mock('./notifications', () => ({
  assertAccountAccessDeliveryConfigured: vi.fn(), sendAccountAccessNotifications: vi.fn(),
}));
vi.mock('./mfa', () => ({
  encryptMfaSecret: vi.fn(), generateMfaSecret: vi.fn(), generateRecoveryCodes: vi.fn(), hashRecoveryCode: vi.fn(), verifyTotpCode: vi.fn(),
}));

const { resendCustomerUserSetupAction } = await import('./actions');

describe('customer setup resend', () => {
  it('requires both the user and its customer to be active', async () => {
    userFindFirst.mockResolvedValue(null);

    await expect(resendCustomerUserSetupAction({ customerId: 'customer-1', userId: 'user-1' })).resolves.toMatchObject({ ok: false });

    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-1', customerId: 'customer-1', role: 'CUSTOMER', isActive: true,
        customer: { is: { isActive: true } },
      },
    });
    expect(issueAuthToken).not.toHaveBeenCalled();
  });
});
