import { describe, expect, it, vi } from 'vitest';
import { getChannelStrategies, getChannelStrategy, type NotificationConfig, type NotificationRecipient } from './channels';
import { getWhatsAppConfig } from './config';
import { getEmailConfig } from './email';
import type { NotificationContent } from './templates';

function makeConfig(whatsappEnv: Record<string, string> = {}, emailEnv: Record<string, string> = {}): NotificationConfig {
  return { email: getEmailConfig(emailEnv), whatsapp: getWhatsAppConfig(whatsappEnv) };
}

const liveWhatsApp = {
  WHATSAPP_SEND_ENABLED: 'true',
  WHATSAPP_ACCESS_TOKEN: 'token',
  WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
  WHATSAPP_TEMPLATE_ORDER_RECEIVED: 'order_received_he',
};

function recipient(overrides: Partial<NotificationRecipient> = {}): NotificationRecipient {
  return {
    isActive: true,
    email: 'client@example.com',
    phone: '050-123-4567',
    notificationPreference: null,
    ...overrides,
  };
}

const content: NotificationContent = {
  templateKey: 'ORDER_RECEIVED',
  subject: 'קיבלנו את הזמנה #1',
  text: 'שלום',
  whatsappParameters: [{ name: 'customer_name', text: 'דנה' }],
};

describe('channel strategies', () => {
  it('exposes email and WhatsApp strategies', () => {
    expect(getChannelStrategies(makeConfig()).map((strategy) => strategy.channel)).toEqual(['EMAIL', 'WHATSAPP']);
  });

  describe('email', () => {
    const email = getChannelStrategy('EMAIL', makeConfig());

    it('is always enabled', () => {
      expect(email.isEnabled()).toBe(true);
    });

    it('sends to active customers by default unless they opted out', () => {
      expect(email.resolveAddress(recipient())).toBe('client@example.com');
      expect(email.resolveAddress(recipient({ notificationPreference: { emailEnabled: true, whatsappEnabled: false } }))).toBe('client@example.com');
      expect(email.resolveAddress(recipient({ notificationPreference: { emailEnabled: false, whatsappEnabled: true } }))).toBeNull();
      expect(email.resolveAddress(recipient({ isActive: false }))).toBeNull();
      expect(email.resolveAddress(recipient({ email: null }))).toBeNull();
    });

    it('prepares a dry-run payload when Resend is not configured and a live one when it is', () => {
      expect(email.prepare(content, 'client@example.com')).toEqual({
        templateName: null,
        dryRun: true,
        payload: { to: 'client@example.com', subject: content.subject, text: content.text },
      });
      const live = getChannelStrategy('EMAIL', makeConfig({}, { RESEND_API_KEY: 're_key', EMAIL_FROM: 'a@example.com' }));
      expect(live.prepare(content, 'client@example.com').dryRun).toBe(false);
    });

    it('sends the stored payload (dry-run without credentials)', async () => {
      await expect(email.send({ payload: { to: 'a@example.com', subject: 's', text: 't' }, templateKey: 'ORDER_RECEIVED', templateName: null }))
        .resolves.toEqual({ mode: 'dry-run', providerMessageId: null });
    });

    it('rejects malformed payloads', async () => {
      await expect((async () => email.send({ payload: { to: 'a@example.com' }, templateKey: 'ORDER_RECEIVED', templateName: null }))()).rejects.toThrow(/email data/);
      await expect((async () => email.send({ payload: null, templateKey: 'ORDER_RECEIVED', templateName: null }))()).rejects.toThrow(/invalid/);
    });
  });

  describe('WhatsApp', () => {
    it('is disabled until live sending is turned on', () => {
      expect(getChannelStrategy('WHATSAPP', makeConfig()).isEnabled()).toBe(false);
      expect(getChannelStrategy('WHATSAPP', makeConfig(liveWhatsApp)).isEnabled()).toBe(true);
    });

    it('only reaches active customers who opted in, at a normalized E.164 number', () => {
      const whatsapp = getChannelStrategy('WHATSAPP', makeConfig(liveWhatsApp));
      const optedIn = { emailEnabled: true, whatsappEnabled: true };

      expect(whatsapp.resolveAddress(recipient({ notificationPreference: optedIn }))).toBe('+972501234567');
      expect(whatsapp.resolveAddress(recipient())).toBeNull();
      expect(whatsapp.resolveAddress(recipient({ notificationPreference: { emailEnabled: true, whatsappEnabled: false } }))).toBeNull();
      expect(whatsapp.resolveAddress(recipient({ isActive: false, notificationPreference: optedIn }))).toBeNull();
      expect(whatsapp.resolveAddress(recipient({ phone: 'abc', notificationPreference: optedIn }))).toBeNull();
    });

    it('prepares the configured template name, language and parameters', () => {
      const whatsapp = getChannelStrategy('WHATSAPP', makeConfig(liveWhatsApp));
      expect(whatsapp.prepare(content, '+972501234567')).toEqual({
        templateName: 'order_received_he',
        dryRun: false,
        payload: { to: '+972501234567', languageCode: 'he', bodyParameters: content.whatsappParameters },
      });
      expect(whatsapp.prepare({ ...content, templateKey: 'ORDER_PACKED' }, '+972501234567').templateName).toBeNull();
    });

    it('falls back to the currently configured template name at send time', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.1' }] }) });
      vi.stubGlobal('fetch', fetchImpl);
      try {
        const whatsapp = getChannelStrategy('WHATSAPP', makeConfig(liveWhatsApp));
        const payload = { to: '+972501234567', languageCode: 'he', bodyParameters: [{ name: 'customer_name', text: 'דנה' }, 'positional'] };

        await expect(whatsapp.send({ payload, templateKey: 'ORDER_RECEIVED', templateName: null }))
          .resolves.toEqual({ mode: 'live', providerMessageId: 'wamid.1' });

        const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(body.template.name).toBe('order_received_he');
        expect(body.template.components[0].parameters).toEqual([
          { type: 'text', parameter_name: 'customer_name', text: 'דנה' },
          { type: 'text', text: 'positional' },
        ]);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('rejects malformed payloads', async () => {
      const whatsapp = getChannelStrategy('WHATSAPP', makeConfig(liveWhatsApp));
      await expect((async () => whatsapp.send({ payload: { to: '+972501234567' }, templateKey: 'ORDER_RECEIVED', templateName: null }))())
        .rejects.toThrow(/WhatsApp template data/);
    });
  });
});
