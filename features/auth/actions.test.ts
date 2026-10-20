import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

const compare = vi.hoisted(() => vi.fn());
const hash = vi.hoisted(() => vi.fn());
const after = vi.hoisted(() => vi.fn());
const consumeRateLimit = vi.hoisted(() => vi.fn());
const assertPasswordTokenUsable = vi.hoisted(() => vi.fn());
const consumePasswordToken = vi.hoisted(() => vi.fn());
const issueAuthToken = vi.hoisted(() => vi.fn());
const issueAuthTokenInTransaction = vi.hoisted(() => vi.fn());
const assertDeliveryConfigured = vi.hoisted(() => vi.fn());
const sendAccountAccessEmail = vi.hoisted(() => vi.fn());
const assertAdminAction = vi.hoisted(() => vi.fn());
const mfa = vi.hoisted(() => ({
  decryptMfaSecret: vi.fn(),
  encryptMfaSecret: vi.fn(),
  generateMfaSecret: vi.fn(),
  generateRecoveryCodes: vi.fn(),
  hashRecoveryCode: vi.fn(),
  verifyTotpCode: vi.fn(),
}));

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('bcryptjs', () => ({ default: { compare, hash } }));
vi.mock('next/server', () => ({ after }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/authorization', () => ({ assertAdminAction, assertCustomerAction: vi.fn() }));
vi.mock('./request', () => ({
  getRequestIp: vi.fn(async () => '203.0.113.7'),
  getRequestBaseUrl: vi.fn(async () => 'https://example.com'),
}));
vi.mock('./rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./rate-limit')>()),
  consumeRateLimit,
}));
vi.mock('./tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tokens')>()),
  assertPasswordTokenUsable,
  consumePasswordToken,
  issueAuthToken,
  issueAuthTokenInTransaction,
}));
vi.mock('./notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./notifications')>()),
  assertAccountAccessDeliveryConfigured: assertDeliveryConfigured,
  sendAccountAccessEmail,
}));
vi.mock('./mfa', () => mfa);

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { RateLimitError } = await import('./rate-limit');
const { InvalidAuthTokenError } = await import('./tokens');
const { AccountAccessDeliveryError } = await import('./notifications');
const {
  confirmMfaEnrollmentAction,
  inviteCustomerUserAction,
  requestPasswordResetAction,
  resendCustomerUserSetupAction,
  setCustomerUserActiveAction,
  setPasswordWithTokenAction,
  startMfaEnrollmentAction,
} = await import('./actions');

const GENERIC_RESET = 'אם קיים חשבון פעיל עבור הכתובת, נשלח אליו קישור מאובטח לאיפוס סיסמה.';
const strongPassword = 'correct horse 2026';

beforeEach(() => {
  vi.clearAllMocks();
  db.$reset();
  [consumeRateLimit, assertPasswordTokenUsable, consumePasswordToken, issueAuthToken, issueAuthTokenInTransaction,
    sendAccountAccessEmail, ...Object.values(mfa)].forEach((mock) => mock.mockReset());
  sendAccountAccessEmail.mockResolvedValue(undefined);
  assertAdminAction.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
  consumeRateLimit.mockResolvedValue({ remaining: 3 });
  compare.mockResolvedValue(false);
  hash.mockResolvedValue('new-hash');
  assertDeliveryConfigured.mockImplementation(() => undefined);
  db.auditLog.create.mockResolvedValue({});
});

describe('password reset request', () => {
  it('limits password reset independently by IP and normalized account', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(requestPasswordResetAction({ email: ' Buyer@Example.com ' })).resolves.toEqual({
      ok: true, data: { message: GENERIC_RESET },
    });

    expect(consumeRateLimit).toHaveBeenNthCalledWith(1, 'password-reset-ip', '203.0.113.7');
    expect(consumeRateLimit).toHaveBeenNthCalledWith(2, 'password-reset-account', 'buyer@example.com');
  });

  it('surfaces the Hebrew RATE_LIMITED message before looking up the account', async () => {
    consumeRateLimit.mockRejectedValueOnce(new RateLimitError());
    await expect(requestPasswordResetAction({ email: 'buyer@example.com' })).resolves.toEqual({
      ok: false, code: 'RATE_LIMITED', error: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('defers reset email delivery and applies the same timing padding for an active account', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, role: 'CUSTOMER', customer: { isActive: true } });
    issueAuthToken.mockResolvedValue({ url: 'https://example.com/reset-password?token=secret' });

    const result = await requestPasswordResetAction({ email: 'buyer@example.com' });
    expect(result).toEqual({ ok: true, data: { message: GENERIC_RESET } });

    expect(issueAuthToken).toHaveBeenCalledWith({ userId: 'user-1', type: 'PASSWORD_RESET', baseUrl: 'https://example.com' });
    expect(compare).toHaveBeenCalledWith('password-reset-timing-pad', expect.any(String));
    expect(sendAccountAccessEmail).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain('secret');

    sendAccountAccessEmail.mockResolvedValue(undefined);
    await after.mock.calls[0][0]();
    expect(sendAccountAccessEmail).toHaveBeenCalledWith({
      userId: 'user-1', type: 'PASSWORD_RESET', url: 'https://example.com/reset-password?token=secret',
    });
  });

  it.each([
    ['unknown account', null],
    ['inactive user', { id: 'u', isActive: false, role: 'CUSTOMER', customer: { isActive: true } }],
    ['inactive company', { id: 'u', isActive: true, role: 'CUSTOMER', customer: { isActive: false } }],
  ])('answers identically and still pads timing for an %s', async (_label, user) => {
    db.user.findUnique.mockResolvedValue(user);
    await expect(requestPasswordResetAction({ email: 'who@example.com' })).resolves.toEqual({
      ok: true, data: { message: GENERIC_RESET },
    });
    expect(issueAuthToken).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
    expect(compare).toHaveBeenCalledWith('password-reset-timing-pad', expect.any(String));
  });

  it('answers identically without issuing a token when email delivery is not configured', async () => {
    assertDeliveryConfigured.mockImplementation(() => { throw new AccountAccessDeliveryError(); });
    db.user.findUnique.mockResolvedValue({ id: 'admin-1', isActive: true, role: 'ADMIN', customer: null });
    await expect(requestPasswordResetAction({ email: 'admin@example.com' })).resolves.toEqual({
      ok: true, data: { message: GENERIC_RESET },
    });
    expect(issueAuthToken).not.toHaveBeenCalled();
  });

  it('swallows and logs deferred delivery failures', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    db.user.findUnique.mockResolvedValue({ id: 'admin-1', isActive: true, role: 'ADMIN', customer: null });
    issueAuthToken.mockResolvedValue({ url: 'https://example.com/reset-password?token=t' });
    sendAccountAccessEmail.mockRejectedValue(new AccountAccessDeliveryError());

    await requestPasswordResetAction({ email: 'admin@example.com' });
    await expect(after.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith('Failed to send password reset email', expect.objectContaining({ userId: 'admin-1' }));
    errorLog.mockRestore();
  });
});

describe('set password with token', () => {
  const input = { token: 'x'.repeat(64), type: 'reset', password: strongPassword, passwordConfirmation: strongPassword };

  it('rejects an unusable token before running the expensive password hash', async () => {
    assertPasswordTokenUsable.mockRejectedValueOnce(new InvalidAuthTokenError());

    await expect(setPasswordWithTokenAction(input)).resolves.toEqual({
      ok: false, code: 'INVALID_TOKEN', error: 'הקישור אינו תקף או שפג תוקפו. בקשו קישור חדש.',
    });
    expect(hash).not.toHaveBeenCalled();
    expect(consumePasswordToken).not.toHaveBeenCalled();
  });

  it('enforces the password policy (min 10, a letter and a digit) and matching confirmation', async () => {
    for (const password of ['short1a', 'onlyletters-here', '1234567890123']) {
      await expect(setPasswordWithTokenAction({ ...input, password, passwordConfirmation: password }))
        .resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    }
    await expect(setPasswordWithTokenAction({ ...input, passwordConfirmation: 'different 2026x' }))
      .resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR', error: 'הסיסמאות אינן זהות.' });
    expect(assertPasswordTokenUsable).not.toHaveBeenCalled();
  });

  it('consumes the token with the hashed password and routes by role', async () => {
    consumePasswordToken.mockResolvedValueOnce({ userId: 'u', role: 'CUSTOMER', customerId: 'c' });
    await expect(setPasswordWithTokenAction(input)).resolves.toEqual({ ok: true, data: { redirectTo: '/login' } });
    expect(consumePasswordToken).toHaveBeenCalledWith({ token: input.token, type: 'PASSWORD_RESET', passwordHash: 'new-hash' });

    consumePasswordToken.mockResolvedValueOnce({ userId: 'a', role: 'ADMIN', customerId: null });
    await expect(setPasswordWithTokenAction({ ...input, type: 'setup' })).resolves.toEqual({
      ok: true, data: { redirectTo: '/login?next=/admin' },
    });
    expect(consumePasswordToken).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'PASSWORD_SETUP' }));
  });
});

describe('customer user administration', () => {
  it('requires admin authorization', async () => {
    const { AuthorizationError } = await import('@/lib/errors');
    assertAdminAction.mockRejectedValueOnce(new AuthorizationError());
    await expect(inviteCustomerUserAction({ customerId: 'c-1', name: 'Buyer', email: 'b@example.com' }))
      .resolves.toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('refuses to invite when account email delivery is not configured', async () => {
    assertDeliveryConfigured.mockImplementation(() => { throw new AccountAccessDeliveryError('not configured'); });
    await expect(inviteCustomerUserAction({ customerId: 'c-1', name: 'Buyer', email: 'b@example.com' }))
      .resolves.toEqual({ ok: false, code: 'DELIVERY_UNAVAILABLE', error: 'not configured' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('invites a passwordless user under the customer lock, audits it and emails the setup link', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'c-1', isActive: true }]);
    db.user.create.mockResolvedValue({ id: 'u-9', name: 'Buyer', email: 'b@example.com', role: 'CUSTOMER' });
    issueAuthTokenInTransaction.mockResolvedValue({ url: 'https://example.com/setup-password?token=t' });

    await expect(inviteCustomerUserAction({ customerId: 'c-1', name: 'Buyer', email: 'B@Example.com' }))
      .resolves.toEqual({ ok: true, data: { userId: 'u-9' } });
    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: 'c-1', email: 'b@example.com', passwordHash: null, role: 'CUSTOMER' }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'CUSTOMER_USER_INVITED', entityId: 'u-9', actorUserId: 'admin-1' }),
    });
    expect(sendAccountAccessEmail).toHaveBeenCalledWith({
      userId: 'u-9', type: 'PASSWORD_SETUP', url: 'https://example.com/setup-password?token=t',
    });
  });

  it('does not invite users into an inactive company', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'c-1', isActive: false }]);
    await expect(inviteCustomerUserAction({ customerId: 'c-1', name: 'Buyer', email: 'b@example.com' }))
      .resolves.toMatchObject({ ok: false });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate login email to CONFLICT', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'c-1', isActive: true }]);
    db.user.create.mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));
    await expect(inviteCustomerUserAction({ customerId: 'c-1', name: 'Buyer', email: 'b@example.com' }))
      .resolves.toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(sendAccountAccessEmail).not.toHaveBeenCalled();
  });

  it('reports a delivery failure after the invite was saved', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'c-1', isActive: true }]);
    db.user.create.mockResolvedValue({ id: 'u-9', name: 'Buyer', email: 'b@example.com', role: 'CUSTOMER' });
    issueAuthTokenInTransaction.mockResolvedValue({ url: 'https://example.com/setup-password?token=t' });
    sendAccountAccessEmail.mockRejectedValue(new AccountAccessDeliveryError());
    await expect(inviteCustomerUserAction({ customerId: 'c-1', name: 'Buyer', email: 'b@example.com' }))
      .resolves.toMatchObject({ ok: false, code: 'DELIVERY_UNAVAILABLE' });
  });

  it('deactivates a user, revokes open links and audits the change', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'c-1', isActive: true }]);
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.authToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(setCustomerUserActiveAction({ customerId: 'c-1', userId: 'u-1', isActive: false }))
      .resolves.toEqual({ ok: true, data: { userId: 'u-1' } });
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u-1', customerId: 'c-1', role: 'CUSTOMER' },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });
    expect(db.authToken.updateMany).toHaveBeenCalledWith({ where: { userId: 'u-1', usedAt: null }, data: { usedAt: expect.any(Date) } });
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'CUSTOMER_USER_DEACTIVATED' }) });
  });

  it('refuses to activate a user while the company is inactive', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'c-1', isActive: false }]);
    await expect(setCustomerUserActiveAction({ customerId: 'c-1', userId: 'u-1', isActive: true }))
      .resolves.toMatchObject({ ok: false });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND for an unknown customer', async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(setCustomerUserActiveAction({ customerId: 'c-x', userId: 'u-1', isActive: true }))
      .resolves.toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('resends setup only to an active, passwordless user of an active customer', async () => {
    db.user.findFirst.mockResolvedValue(null);

    await expect(resendCustomerUserSetupAction({ customerId: 'customer-1', userId: 'user-1' })).resolves.toMatchObject({ ok: false });
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-1', customerId: 'customer-1', role: 'CUSTOMER', isActive: true,
        customer: { is: { isActive: true } },
      },
    });
    expect(issueAuthToken).not.toHaveBeenCalled();

    db.user.findFirst.mockResolvedValue({ id: 'user-1', passwordHash: 'already-set' });
    await expect(resendCustomerUserSetupAction({ customerId: 'customer-1', userId: 'user-1' })).resolves.toMatchObject({ ok: false });
    expect(issueAuthToken).not.toHaveBeenCalled();

    db.user.findFirst.mockResolvedValue({ id: 'user-1', passwordHash: null });
    issueAuthToken.mockResolvedValue({ url: 'https://example.com/setup-password?token=n' });
    await expect(resendCustomerUserSetupAction({ customerId: 'customer-1', userId: 'user-1' }))
      .resolves.toEqual({ ok: true, data: { userId: 'user-1' } });
    expect(sendAccountAccessEmail).toHaveBeenCalledWith({
      userId: 'user-1', type: 'PASSWORD_SETUP', url: 'https://example.com/setup-password?token=n',
    });
  });
});

describe('MFA enrollment', () => {
  beforeEach(() => {
    mfa.generateMfaSecret.mockReturnValue('NEWSECRET');
    mfa.encryptMfaSecret.mockReturnValue('encrypted-new');
    db.user.update.mockResolvedValue({});
  });

  it('requires the current password before replacing an active factor', async () => {
    db.user.findUnique.mockResolvedValue({ email: 'admin@example.com', mfaEnabled: true, passwordHash: 'password-hash' });
    compare.mockResolvedValue(false);

    await expect(startMfaEnrollmentAction({ password: 'wrong-password' })).resolves.toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
    await expect(startMfaEnrollmentAction({})).resolves.toMatchObject({ ok: false, code: 'UNAUTHORIZED' });

    expect(compare).toHaveBeenCalledWith('wrong-password', 'password-hash');
    expect(consumeRateLimit).toHaveBeenNthCalledWith(1, 'mfa-replacement-ip', '203.0.113.7');
    expect(consumeRateLimit).toHaveBeenNthCalledWith(2, 'mfa-replacement-account', 'admin-1');
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('rate-limits replacement attempts before checking the password', async () => {
    db.user.findUnique.mockResolvedValue({ email: 'admin@example.com', mfaEnabled: true, passwordHash: 'password-hash' });
    consumeRateLimit.mockRejectedValueOnce(new RateLimitError());
    await expect(startMfaEnrollmentAction({ password: 'guess' })).resolves.toMatchObject({ ok: false, code: 'RATE_LIMITED' });
    expect(compare).not.toHaveBeenCalled();
  });

  it('allows password-verified repair when the current authenticator is unavailable', async () => {
    db.user.findUnique.mockResolvedValue({ email: 'admin@example.com', mfaEnabled: true, passwordHash: 'password-hash' });
    compare.mockResolvedValue(true);

    const result = await startMfaEnrollmentAction({ password: 'current-password' });
    expect(result).toMatchObject({ ok: true, data: { secret: 'NEWSECRET' } });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { mfaPendingSecretEncrypted: 'encrypted-new' },
    });
  });

  it('stores a first-time secret as pending without requiring a password', async () => {
    db.user.findUnique.mockResolvedValue({ email: 'admin@example.com', mfaEnabled: false, passwordHash: 'password-hash' });

    const result = await startMfaEnrollmentAction({});
    expect(result).toMatchObject({ ok: true, data: { secret: 'NEWSECRET', uri: expect.stringContaining('otpauth://totp/') } });
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { mfaPendingSecretEncrypted: 'encrypted-new' },
    });
  });

  it('atomically activates the verified pending secret and replaces recovery codes', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'admin-1', mfaPendingSecretEncrypted: 'encrypted-new' });
    mfa.decryptMfaSecret.mockReturnValue('NEWSECRET');
    mfa.verifyTotpCode.mockReturnValue(true);
    mfa.generateRecoveryCodes.mockReturnValue(['recover-1', 'recover-2']);
    mfa.hashRecoveryCode.mockImplementation((code: string) => `hash:${code}`);
    db.user.updateMany.mockResolvedValue({ count: 1 });

    await expect(confirmMfaEnrollmentAction({ code: '123456' })).resolves.toEqual({
      ok: true,
      data: { recoveryCodes: ['recover-1', 'recover-2'] },
    });

    expect(consumeRateLimit).toHaveBeenNthCalledWith(1, 'mfa-replacement-ip', '203.0.113.7');
    expect(consumeRateLimit).toHaveBeenNthCalledWith(2, 'mfa-replacement-account', 'admin-1');
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'admin-1', mfaPendingSecretEncrypted: 'encrypted-new' },
      data: {
        mfaEnabled: true,
        mfaSecretEncrypted: 'encrypted-new',
        mfaPendingSecretEncrypted: null,
        sessionVersion: { increment: 1 },
      },
    });
    expect(db.mfaRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'admin-1' } });
    expect(db.mfaRecoveryCode.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'admin-1', codeHash: 'hash:recover-1' }, { userId: 'admin-1', codeHash: 'hash:recover-2' }],
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'ADMIN_MFA_ENABLED' }) });
  });

  it('rejects a wrong code without touching the stored factor', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'admin-1', mfaPendingSecretEncrypted: 'encrypted-new' });
    mfa.decryptMfaSecret.mockReturnValue('NEWSECRET');
    mfa.verifyTotpCode.mockReturnValue(false);
    await expect(confirmMfaEnrollmentAction({ code: '000000' })).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('asks to restart when there is no pending secret', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'admin-1', mfaPendingSecretEncrypted: null });
    await expect(confirmMfaEnrollmentAction({ code: '123456' })).resolves.toMatchObject({ ok: false, code: 'STALE_VERSION' });
  });

  it('rejects a stale confirmation without replacing the active factor or recovery codes', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'admin-1', mfaPendingSecretEncrypted: 'encrypted-old' });
    mfa.decryptMfaSecret.mockReturnValue('OLDSECRET');
    mfa.verifyTotpCode.mockReturnValue(true);
    mfa.generateRecoveryCodes.mockReturnValue(['recover-stale']);
    db.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(confirmMfaEnrollmentAction({ code: '123456' })).resolves.toMatchObject({ ok: false, code: 'STALE_VERSION' });

    expect(db.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'admin-1', mfaPendingSecretEncrypted: 'encrypted-old' },
    }));
    expect(db.mfaRecoveryCode.deleteMany).not.toHaveBeenCalled();
    expect(db.mfaRecoveryCode.createMany).not.toHaveBeenCalled();
  });
});
