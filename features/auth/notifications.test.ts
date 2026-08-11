import { beforeEach, describe, expect, it, vi } from 'vitest';

const userFindUnique = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());
const getEmail = vi.hoisted(() => vi.fn());
const sendWhatsApp = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: userFindUnique } } }));
vi.mock('@/features/notifications/email', () => ({ getEmailConfig: getEmail, sendEmailMessage: sendEmail }));
vi.mock('@/features/notifications/config', () => ({ getWhatsAppConfig: vi.fn(), resolveWhatsAppTemplateName: vi.fn() }));
vi.mock('@/features/notifications/phone', () => ({ normalizePhoneToE164: vi.fn(() => null) }));
vi.mock('@/features/notifications/sender', () => ({ sendWhatsAppTemplate: sendWhatsApp }));

const { AccountAccessDeliveryError, assertAccountAccessDeliveryConfigured, sendAccountAccessNotifications } = await import('./notifications');

describe('account access delivery', () => {
  beforeEach(() => { userFindUnique.mockReset(); sendEmail.mockReset(); getEmail.mockReset(); sendWhatsApp.mockReset(); });

  it('refuses account creation when live email delivery is not configured', () => {
    getEmail.mockReturnValue({ apiKey: null, from: null });
    expect(() => assertAccountAccessDeliveryConfigured()).toThrow(AccountAccessDeliveryError);
    getEmail.mockReturnValue({ apiKey: 're_live', from: 'orders@example.com' });
    expect(() => assertAccountAccessDeliveryConfigured()).not.toThrow();
  });

  it('does not report a dry-run notification as delivered', async () => {
    getEmail.mockReturnValue({ apiKey: null, from: null });
    sendEmail.mockResolvedValue({ mode: 'dry-run', providerMessageId: null });
    userFindUnique.mockResolvedValue({
      id: 'admin-1', email: 'admin@example.com', name: 'Admin', customer: null,
    });
    await expect(sendAccountAccessNotifications({
      userId: 'admin-1', type: 'PASSWORD_RESET', url: 'https://example.com/reset-password?token=raw',
    })).rejects.toBeInstanceOf(AccountAccessDeliveryError);
  });

  it('reports delivery only after the email provider accepts the message', async () => {
    getEmail.mockReturnValue({ apiKey: 're_live', from: 'orders@example.com' });
    sendEmail.mockResolvedValue({ mode: 'live', providerMessageId: 'email-1' });
    userFindUnique.mockResolvedValue({
      id: 'admin-1', email: 'admin@example.com', name: 'Admin', customer: null,
    });
    await expect(sendAccountAccessNotifications({
      userId: 'admin-1', type: 'PASSWORD_RESET', url: 'https://example.com/reset-password?token=raw',
    })).resolves.toMatchObject({ delivered: true, email: 'live' });
  });

  it('surfaces a safe retryable error when the live provider rejects delivery', async () => {
    getEmail.mockReturnValue({ apiKey: 're_live', from: 'orders@example.com' });
    sendEmail.mockRejectedValue(new Error('provider response with internal details'));
    userFindUnique.mockResolvedValue({
      id: 'admin-1', email: 'admin@example.com', name: 'Admin', customer: null,
    });
    await expect(sendAccountAccessNotifications({
      userId: 'admin-1', type: 'PASSWORD_RESET', url: 'https://example.com/reset-password?token=raw',
    })).rejects.toMatchObject({
      name: 'AccountAccessDeliveryError',
      message: expect.not.stringContaining('internal details'),
    });
  });

  it('never sends a personal access token to the company-wide WhatsApp number', async () => {
    getEmail.mockReturnValue({ apiKey: 're_live', from: 'orders@example.com' });
    sendEmail.mockResolvedValue({ mode: 'live', providerMessageId: 'email-1' });
    userFindUnique.mockResolvedValue({
      id: 'buyer-2', email: 'buyer2@example.com', name: 'Buyer Two',
      customer: {
        isActive: true,
        phone: '050-0000000',
        notificationPreference: { whatsappEnabled: true },
      },
    });

    await expect(sendAccountAccessNotifications({
      userId: 'buyer-2', type: 'PASSWORD_SETUP', url: 'https://example.com/setup-password?token=personal',
    })).resolves.toMatchObject({ delivered: true, email: 'live', whatsapp: 'skipped' });
    expect(sendWhatsApp).not.toHaveBeenCalled();
  });
});
