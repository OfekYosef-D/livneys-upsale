import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

const consumeRateLimit = vi.hoisted(() => vi.fn());
const verifyChallenge = vi.hoisted(() => vi.fn());
const issueAuthTokenInTransaction = vi.hoisted(() => vi.fn());
const assertDeliveryConfigured = vi.hoisted(() => vi.fn());
const sendAccountAccessEmail = vi.hoisted(() => vi.fn());
const assertAdminAction = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('@/lib/authorization', () => ({ assertAdminAction, assertCustomerAction: vi.fn() }));
vi.mock('../auth/captcha', () => ({ verifyRegistrationChallenge: verifyChallenge }));
vi.mock('../auth/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/rate-limit')>()),
  consumeRateLimit,
}));
vi.mock('../auth/request', () => ({
  getRequestIp: vi.fn(async () => '127.0.0.1'),
  getRequestBaseUrl: vi.fn(async () => 'https://example.com'),
}));
vi.mock('../auth/tokens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/tokens')>()),
  issueAuthTokenInTransaction,
}));
vi.mock('../auth/notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/notifications')>()),
  assertAccountAccessDeliveryConfigured: assertDeliveryConfigured,
  sendAccountAccessEmail,
}));

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { RateLimitError } = await import('../auth/rate-limit');
const { AccountAccessDeliveryError } = await import('../auth/notifications');
const {
  convertRegistrationToCustomerAction,
  createCompanyRegistrationAction,
  updateRegistrationStatusAction,
} = await import('./actions');

const registrationForm = {
  businessName: 'Cafe South',
  invoiceName: 'Cafe South Ltd',
  contactName: 'Dana',
  phone: '050-1111111',
  email: 'Dana@Example.com',
  accountingContactName: '',
  accountingEmail: '',
  accountingPhone: '',
  businessType: 'בתי קפה',
  address: 'Industrial 4',
  deliveryNotes: '',
  openingOrderNotes: '',
  challengeToken: 'turnstile-token',
};

const lead = {
  id: 'lead-1',
  status: 'PENDING',
  businessName: 'Cafe South',
  invoiceName: 'Cafe South Ltd',
  contactName: 'Dana',
  phone: '050-1111111',
  email: 'dana@example.com',
  accountingContactName: 'Roni',
  accountingEmail: 'accounting@example.com',
  accountingPhone: '050-2222222',
  businessType: 'בתי קפה',
  address: 'Industrial 4',
  deliveryNotes: 'No Fridays',
  openingOrderNotes: 'Needs tasting',
};

beforeEach(() => {
  vi.clearAllMocks();
  db.$reset();
  [consumeRateLimit, verifyChallenge, issueAuthTokenInTransaction, assertDeliveryConfigured, sendAccountAccessEmail, assertAdminAction]
    .forEach((mock) => mock.mockReset());
  consumeRateLimit.mockResolvedValue({ remaining: 2 });
  verifyChallenge.mockResolvedValue(true);
  sendAccountAccessEmail.mockResolvedValue(undefined);
  assertAdminAction.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
  issueAuthTokenInTransaction.mockResolvedValue({ url: 'https://example.com/setup-password?token=raw' });
  db.auditLog.create.mockResolvedValue({});
});

describe('public company registration', () => {
  it('creates a pending request without admin auth, stripping bot-check fields', async () => {
    db.companyRegistrationRequest.create.mockResolvedValue({ id: 'lead-1' });

    const result = await createCompanyRegistrationAction(registrationForm);

    expect(result).toEqual({ ok: true, data: { requestId: 'lead-1' } });
    expect(assertAdminAction).not.toHaveBeenCalled();
    const data = db.companyRegistrationRequest.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      businessName: 'Cafe South',
      email: 'dana@example.com',
      accountingEmail: null,
      deliveryNotes: null,
      status: 'PENDING',
    });
    expect(data).not.toHaveProperty('website');
    expect(data).not.toHaveProperty('challengeToken');
    expect(verifyChallenge).toHaveBeenCalledWith({ token: 'turnstile-token', honeypot: '', ip: '127.0.0.1' });
    expect(consumeRateLimit).toHaveBeenNthCalledWith(1, 'registration-ip', '127.0.0.1');
    expect(consumeRateLimit).toHaveBeenNthCalledWith(2, 'registration-account', 'dana@example.com');
  });

  it('does not consume the victim account bucket before CAPTCHA succeeds', async () => {
    verifyChallenge.mockResolvedValueOnce(false);

    const result = await createCompanyRegistrationAction({ ...registrationForm, email: 'victim@example.com' });

    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR', error: 'לא ניתן לאמת את הבקשה. רעננו את הדף ונסו שוב.' });
    expect(consumeRateLimit).toHaveBeenCalledOnce();
    expect(consumeRateLimit).toHaveBeenCalledWith('registration-ip', '127.0.0.1');
    expect(db.companyRegistrationRequest.create).not.toHaveBeenCalled();
  });

  it('counts a bot that fills the honeypot against the rate limit and rejects it with a generic message', async () => {
    verifyChallenge.mockResolvedValueOnce(false);
    const result = await createCompanyRegistrationAction({ ...registrationForm, website: 'http://spam.example' });
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(result).not.toMatchObject({ error: expect.stringContaining('website') });
    expect(consumeRateLimit).toHaveBeenCalledWith('registration-ip', expect.any(String));
    expect(verifyChallenge).toHaveBeenCalledWith(expect.objectContaining({ honeypot: 'http://spam.example' }));
    expect(db.companyRegistrationRequest.create).not.toHaveBeenCalled();
  });

  it('returns the Hebrew RATE_LIMITED message when blocked', async () => {
    consumeRateLimit.mockRejectedValueOnce(new RateLimitError());
    await expect(createCompanyRegistrationAction(registrationForm)).resolves.toEqual({
      ok: false, code: 'RATE_LIMITED', error: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
    });
    expect(verifyChallenge).not.toHaveBeenCalled();
  });
});

describe('registration status updates', () => {
  it('updates status with an audit entry', async () => {
    db.companyRegistrationRequest.findUnique.mockResolvedValue({ status: 'PENDING' });

    await expect(updateRegistrationStatusAction({ id: 'lead-1', status: 'CONTACTED', internalNote: 'called' }))
      .resolves.toEqual({ ok: true, data: { requestId: 'lead-1' } });
    expect(db.companyRegistrationRequest.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' }, data: { status: 'CONTACTED', internalNote: 'called' },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'REGISTRATION_STATUS_CHANGED', entityId: 'lead-1', actorUserId: 'admin-1' }),
    });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('refuses to change a converted request and reports a missing one', async () => {
    db.companyRegistrationRequest.findUnique.mockResolvedValueOnce({ status: 'CONVERTED' });
    await expect(updateRegistrationStatusAction({ id: 'lead-1', status: 'ARCHIVED' })).resolves.toMatchObject({ ok: false });
    db.companyRegistrationRequest.findUnique.mockResolvedValueOnce(null);
    await expect(updateRegistrationStatusAction({ id: 'lead-x', status: 'ARCHIVED' })).resolves.toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.companyRegistrationRequest.update).not.toHaveBeenCalled();
  });
});

describe('registration conversion', () => {
  beforeEach(() => {
    db.route.findUnique.mockResolvedValue({ isActive: true, region: 'דרום' });
    db.priceList.findUnique.mockResolvedValue({ id: 'price-list-standard' });
    db.companyRegistrationRequest.findUnique.mockResolvedValue(lead);
    db.customer.create.mockResolvedValue({});
    db.user.create.mockResolvedValue({ id: 'user-cafe-south' });
  });

  const convertInput = { requestId: 'lead-1', routeId: 'route-south', priceListId: 'price-list-standard' };

  it('converts an approved lead into a customer and login user, taking the region from the route', async () => {
    const result = await convertRegistrationToCustomerAction(convertInput);

    expect(result.ok).toBe(true);
    const customerId = result.ok ? result.data.customerId : '';
    expect(customerId).toMatch(/^cust-/);
    expect(db.customer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: customerId,
        name: 'Cafe South',
        invoiceName: 'Cafe South Ltd',
        businessType: 'בתי קפה',
        region: 'דרום',
        deliveryConstraints: 'No Fridays',
        routeId: 'route-south',
        priceListId: 'price-list-standard',
        notificationPreference: { create: { emailEnabled: true, whatsappEnabled: true } },
      }),
    });
    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'dana@example.com', passwordHash: null, role: 'CUSTOMER', customerId }),
    });
    expect(db.companyRegistrationRequest.update).toHaveBeenCalledWith({
      where: { id: 'lead-1' },
      data: { status: 'CONVERTED', convertedCustomerId: customerId },
    });
    expect(issueAuthTokenInTransaction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'user-cafe-south', type: 'PASSWORD_SETUP', baseUrl: 'https://example.com',
    }));
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'REGISTRATION_CONVERTED', customerId }) });
    expect(sendAccountAccessEmail).toHaveBeenCalledWith({
      userId: 'user-cafe-south', type: 'PASSWORD_SETUP', url: 'https://example.com/setup-password?token=raw',
    });
    expect(JSON.stringify(result)).not.toContain('token=raw');
  });

  it('refuses before any write when account email delivery is not configured', async () => {
    assertDeliveryConfigured.mockImplementation(() => { throw new AccountAccessDeliveryError('not configured'); });
    await expect(convertRegistrationToCustomerAction(convertInput)).resolves.toMatchObject({ ok: false, code: 'DELIVERY_UNAVAILABLE' });
    expect(db.customer.create).not.toHaveBeenCalled();
  });

  it('does not convert the same request twice', async () => {
    db.companyRegistrationRequest.findUnique.mockResolvedValue({ ...lead, status: 'CONVERTED' });
    await expect(convertRegistrationToCustomerAction(convertInput)).resolves.toMatchObject({ ok: false });
    expect(db.customer.create).not.toHaveBeenCalled();
  });

  it('requires an active route', async () => {
    db.route.findUnique.mockResolvedValue({ isActive: false, region: 'דרום' });
    await expect(convertRegistrationToCustomerAction(convertInput)).resolves.toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(db.customer.create).not.toHaveBeenCalled();
  });

  it('does not report a successful conversion when the setup link was not delivered', async () => {
    sendAccountAccessEmail.mockRejectedValueOnce(new AccountAccessDeliveryError());

    const result = await convertRegistrationToCustomerAction(convertInput);

    expect(result).toMatchObject({ ok: false, code: 'DELIVERY_UNAVAILABLE' });
    // The customer was committed before delivery; the admin can resend the link from the customer card.
    expect(db.customer.create).toHaveBeenCalled();
  });
});
