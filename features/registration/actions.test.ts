import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as actions from './actions';

const registrationCreateMock = vi.hoisted(() => vi.fn());
const registrationFindUniqueMock = vi.hoisted(() => vi.fn());
const registrationUpdateMock = vi.hoisted(() => vi.fn());
const routeFindUniqueMock = vi.hoisted(() => vi.fn());
const priceListFindUniqueMock = vi.hoisted(() => vi.fn());
const customerCreateMock = vi.hoisted(() => vi.fn());
const userCreateMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const verifyChallengeMock = vi.hoisted(() => vi.fn(async () => true));
const issueAuthTokenMock = vi.hoisted(() => vi.fn(async () => ({ url: 'https://example.com/setup-password?token=raw' })));
const sendAccountAccessNotificationsMock = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../auth/captcha', () => ({ verifyRegistrationChallenge: verifyChallengeMock }));
vi.mock('../auth/rate-limit', () => ({ consumeRateLimit: consumeRateLimitMock }));
vi.mock('../auth/request', () => ({ getRequestIp: vi.fn(async () => '127.0.0.1'), getRequestBaseUrl: vi.fn(async () => 'https://example.com') }));
vi.mock('../auth/tokens', () => ({ issueAuthTokenInTransaction: issueAuthTokenMock }));
vi.mock('../auth/notifications', () => ({
  assertAccountAccessDeliveryConfigured: vi.fn(),
  sendAccountAccessNotifications: sendAccountAccessNotificationsMock,
}));

vi.mock('@/lib/authorization', () => ({
  assertAdminAction: vi.fn(),
}));

vi.mock('@/lib/action-result', () => ({
  actionOk: (data: unknown) => ({ ok: true, data }),
  actionError: (error: unknown) => ({
    ok: false,
    error: error instanceof Error ? error.message : 'Unexpected error',
    ...(error && typeof error === 'object' && 'code' in error ? { code: error.code } : {}),
  }),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    companyRegistrationRequest: {
      create: registrationCreateMock,
      findUnique: registrationFindUniqueMock,
      update: registrationUpdateMock,
    },
    route: {
      findUnique: routeFindUniqueMock,
    },
    priceList: {
      findUnique: priceListFindUniqueMock,
    },
    customer: {
      create: customerCreateMock,
    },
    user: {
      create: userCreateMock,
    },
    $transaction: vi.fn(async (callback) =>
      callback({
        companyRegistrationRequest: {
          findUnique: registrationFindUniqueMock,
          update: registrationUpdateMock,
        },
        customer: {
          create: customerCreateMock,
        },
        user: {
          create: userCreateMock,
        },
      }),
    ),
  },
}));

const { prisma } = await import('@/lib/db');
const { assertAdminAction } = await import('@/lib/authorization');
const { revalidatePath } = await import('next/cache');

const mockedAssertAdminAction = vi.mocked(assertAdminAction);
const mockedRegistrationCreate = vi.mocked(prisma.companyRegistrationRequest.create);
const mockedRegistrationFindUnique = vi.mocked(prisma.companyRegistrationRequest.findUnique);
const mockedRegistrationUpdate = vi.mocked(prisma.companyRegistrationRequest.update);
const mockedRouteFindUnique = vi.mocked(prisma.route.findUnique);
const mockedPriceListFindUnique = vi.mocked(prisma.priceList.findUnique);
const mockedCustomerCreate = vi.mocked(prisma.customer.create);
const mockedUserCreate = vi.mocked(prisma.user.create);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('registration actions', () => {
  beforeEach(() => {
    mockedAssertAdminAction.mockReset();
    mockedRegistrationCreate.mockReset();
    mockedRegistrationFindUnique.mockReset();
    mockedRegistrationUpdate.mockReset();
    mockedRouteFindUnique.mockReset();
    mockedPriceListFindUnique.mockReset();
    mockedCustomerCreate.mockReset();
    mockedUserCreate.mockReset();
    consumeRateLimitMock.mockClear();
    verifyChallengeMock.mockClear();
    issueAuthTokenMock.mockClear();
    sendAccountAccessNotificationsMock.mockClear();
    mockedRevalidatePath.mockClear();
  });

  it('creates public company registration requests without admin auth', async () => {
    mockedRegistrationCreate.mockResolvedValue({ id: 'lead-1' } as never);

    const result = await actions.createCompanyRegistrationAction({
      businessName: 'Cafe South',
      invoiceName: 'Cafe South Ltd',
      contactName: 'Dana',
      phone: '050-1111111',
      email: 'dana@example.com',
      accountingContactName: '',
      accountingEmail: '',
      accountingPhone: '',
      businessType: 'בתי קפה',
      address: 'Industrial 4',
      deliveryNotes: '',
      openingOrderNotes: '',
    });

    expect(result).toEqual({ ok: true, data: { requestId: 'lead-1' } });
    expect(mockedAssertAdminAction).not.toHaveBeenCalled();
    expect(mockedRegistrationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        businessName: 'Cafe South',
        status: 'PENDING',
      }),
    }));
    expect(consumeRateLimitMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      scope: 'registration-ip', identifier: '127.0.0.1', limit: 10,
    }));
    expect(consumeRateLimitMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      scope: 'registration-account', identifier: 'dana@example.com', limit: 3,
    }));
  });

  it('does not consume the victim account bucket before CAPTCHA succeeds', async () => {
    verifyChallengeMock.mockResolvedValueOnce(false);

    const result = await actions.createCompanyRegistrationAction({
      businessName: 'Blocked Bot', invoiceName: 'Blocked Bot Ltd', contactName: 'Bot',
      phone: '050-1111111', email: 'victim@example.com', accountingContactName: '', accountingEmail: '',
      accountingPhone: '', businessType: 'Cafe', address: 'Nowhere', deliveryNotes: '', openingOrderNotes: '',
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ code: 'VALIDATION_ERROR', error: 'לא ניתן לאמת את הבקשה. נסו שוב.' });
    expect(consumeRateLimitMock).toHaveBeenCalledOnce();
    expect(consumeRateLimitMock).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'registration-ip', identifier: '127.0.0.1',
    }));
  });

  it('converts approved leads into customers and login users', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-07-01T00:00:00.000Z',
    });
    mockedRouteFindUnique.mockResolvedValue({ id: 'route-south', isActive: true } as never);
    mockedPriceListFindUnique.mockResolvedValue({ id: 'price-list-standard' } as never);
    mockedRegistrationFindUnique.mockResolvedValue({
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
    } as never);
    mockedCustomerCreate.mockResolvedValue({ id: 'cust-cafe-south' } as never);
    mockedUserCreate.mockResolvedValue({ id: 'user-cafe-south' } as never);

    const result = await actions.convertRegistrationToCustomerAction({
      requestId: 'lead-1',
      routeId: 'route-south',
      priceListId: 'price-list-standard',
    });

    expect(result.ok).toBe(true);
    const customerId = result.ok ? result.data.customerId : '';
    expect(customerId).toMatch(/^cust-cafe-south-/);
    expect(mockedCustomerCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Cafe South',
        invoiceName: 'Cafe South Ltd',
        businessType: 'בתי קפה',
        deliveryConstraints: 'No Fridays',
        notificationPreference: { create: { emailEnabled: true, whatsappEnabled: true } },
      }),
    }));
    expect(mockedUserCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'dana@example.com',
        passwordHash: null,
        role: 'CUSTOMER',
        customerId,
      }),
    }));
    expect(mockedRegistrationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'CONVERTED',
        convertedCustomerId: customerId,
      }),
    }));
    expect(issueAuthTokenMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: 'user-cafe-south', type: 'PASSWORD_SETUP' }));
  });

  it('does not report a successful conversion when the setup link was not delivered', async () => {
    mockedAssertAdminAction.mockResolvedValue({
      user: { id: 'admin', role: 'ADMIN', customerId: null },
      expires: '2026-07-01T00:00:00.000Z',
    });
    mockedRouteFindUnique.mockResolvedValue({ id: 'route-south', isActive: true } as never);
    mockedPriceListFindUnique.mockResolvedValue({ id: 'price-list-standard' } as never);
    mockedRegistrationFindUnique.mockResolvedValue({
      id: 'lead-2', status: 'PENDING', businessName: 'Cafe North', invoiceName: 'Cafe North Ltd',
      contactName: 'Noa', phone: '050-3333333', email: 'noa@example.com', accountingContactName: '',
      accountingEmail: '', accountingPhone: '', businessType: 'Cafe', address: 'North 1',
      deliveryNotes: '', openingOrderNotes: '',
    } as never);
    mockedUserCreate.mockResolvedValue({ id: 'user-cafe-north' } as never);
    sendAccountAccessNotificationsMock.mockRejectedValueOnce(new Error('provider failure'));

    const result = await actions.convertRegistrationToCustomerAction({
      requestId: 'lead-2', routeId: 'route-south', priceListId: 'price-list-standard',
    });

    expect(result).toEqual({ ok: false, error: 'provider failure' });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/admin/registrations');
    expect(mockedRevalidatePath).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/customers\/cust-cafe-north-/));
  });
});
