import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMock } from '@/test/prisma-mock';

const sendEmail = vi.hoisted(() => vi.fn());
const isConfigured = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', async () => (await import('@/test/prisma-mock')).prismaModule());
vi.mock('@/features/notifications/email', () => ({
  getEmailConfig: vi.fn(() => ({ apiKey: 're_live', from: 'orders@example.com', replyTo: null })),
  isEmailConfigured: isConfigured,
  sendEmailMessage: sendEmail,
}));

const { prisma } = await import('@/lib/db');
const db = asMock(prisma);
const { actionError } = await import('@/lib/action-result');
const { AccountAccessDeliveryError, assertAccountAccessDeliveryConfigured, sendAccountAccessEmail } = await import('./notifications');

const resetRequest = { userId: 'admin-1', type: 'PASSWORD_RESET' as const, url: 'https://example.com/reset-password?token=raw' };

describe('account access delivery', () => {
  beforeEach(() => {
    db.$reset();
    sendEmail.mockReset();
    isConfigured.mockReset();
    db.user.findUnique.mockResolvedValue({ email: 'admin@example.com', name: 'Admin' });
  });

  it('refuses account creation when live email delivery is not configured', () => {
    isConfigured.mockReturnValue(false);
    expect(() => assertAccountAccessDeliveryConfigured()).toThrow(AccountAccessDeliveryError);
    isConfigured.mockReturnValue(true);
    expect(() => assertAccountAccessDeliveryConfigured()).not.toThrow();
  });

  it('is an AppError so actions show its Hebrew message with code DELIVERY_UNAVAILABLE', () => {
    const result = actionError(new AccountAccessDeliveryError());
    expect(result).toMatchObject({ ok: false, code: 'DELIVERY_UNAVAILABLE' });
    expect(result).not.toHaveProperty('requestId');
  });

  it('does not report a dry-run notification as delivered', async () => {
    sendEmail.mockResolvedValue({ mode: 'dry-run', providerMessageId: null });
    await expect(sendAccountAccessEmail(resetRequest)).rejects.toBeInstanceOf(AccountAccessDeliveryError);
  });

  it('resolves only after the email provider accepts the message, sending the link to the user email', async () => {
    sendEmail.mockResolvedValue({ mode: 'live', providerMessageId: 'email-1' });
    await expect(sendAccountAccessEmail(resetRequest)).resolves.toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: 'admin@example.com' });
    expect(sendEmail.mock.calls[0][0].text).toContain(resetRequest.url);
  });

  it('fails when the user no longer exists', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(sendAccountAccessEmail(resetRequest)).rejects.toBeInstanceOf(AccountAccessDeliveryError);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('surfaces a safe retryable error when the live provider rejects delivery', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sendEmail.mockRejectedValue(new Error('provider response with internal details'));
    await expect(sendAccountAccessEmail(resetRequest)).rejects.toMatchObject({
      name: 'AccountAccessDeliveryError',
      code: 'DELIVERY_UNAVAILABLE',
      message: expect.not.stringContaining('internal details'),
    });
    errorLog.mockRestore();
  });
});
