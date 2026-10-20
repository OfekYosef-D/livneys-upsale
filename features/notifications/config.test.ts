import { describe, expect, it } from 'vitest';
import { getAppBaseUrl, getWhatsAppConfig, hasWhatsAppProviderCredentials, notificationTemplateKeys } from './config';

describe('WhatsApp notification config', () => {
  it('defaults to disabled sending with Meta defaults and no templates', () => {
    const config = getWhatsAppConfig({});

    expect(config.sendEnabled).toBe(false);
    expect(config.graphApiVersion).toBe('v25.0');
    expect(config.templateLanguage).toBe('he');
    expect(config.accessToken).toBeNull();
    expect(config.webhookVerifyToken).toBeNull();
    expect(Object.keys(config.templates).sort()).toEqual([...notificationTemplateKeys].sort());
    expect(Object.values(config.templates).every((name) => name === null)).toBe(true);
  });

  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['yes', false],
    [undefined, false],
  ])('parses WHATSAPP_SEND_ENABLED=%s as %s', (value, expected) => {
    expect(getWhatsAppConfig({ WHATSAPP_SEND_ENABLED: value }).sendEnabled).toBe(expected);
  });

  it('reads per-message template names from env and treats blanks as missing', () => {
    const config = getWhatsAppConfig({
      WHATSAPP_TEMPLATE_ORDER_RECEIVED: '  livneys_order_received_he ',
      WHATSAPP_TEMPLATE_ORDER_ADDITION_REJECTED: 'addition_rejected',
      WHATSAPP_TEMPLATE_ORDER_REMINDER: '   ',
    });

    expect(config.templates.ORDER_RECEIVED).toBe('livneys_order_received_he');
    expect(config.templates.ORDER_ADDITION_REJECTED).toBe('addition_rejected');
    expect(config.templates.ORDER_REMINDER).toBeNull();
  });

  it('overrides API version and template language', () => {
    const config = getWhatsAppConfig({ WHATSAPP_GRAPH_API_VERSION: 'v30.0', WHATSAPP_TEMPLATE_LANGUAGE: 'he_IL' });
    expect(config.graphApiVersion).toBe('v30.0');
    expect(config.templateLanguage).toBe('he_IL');
  });

  it('requires both access token and phone number id for provider credentials', () => {
    expect(hasWhatsAppProviderCredentials(getWhatsAppConfig({ WHATSAPP_ACCESS_TOKEN: 't' }))).toBe(false);
    expect(hasWhatsAppProviderCredentials(getWhatsAppConfig({ WHATSAPP_PHONE_NUMBER_ID: 'p' }))).toBe(false);
    expect(hasWhatsAppProviderCredentials(getWhatsAppConfig({ WHATSAPP_ACCESS_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: 'p' }))).toBe(true);
  });
});

describe('getAppBaseUrl', () => {
  it('uses NEXTAUTH_URL without trailing slashes', () => {
    expect(getAppBaseUrl({ NEXTAUTH_URL: 'https://orders.example.com//' })).toBe('https://orders.example.com');
    expect(getAppBaseUrl({ NEXTAUTH_URL: 'https://orders.example.com' })).toBe('https://orders.example.com');
  });

  it('falls back to localhost when unset or blank', () => {
    expect(getAppBaseUrl({})).toBe('http://localhost:3000');
    expect(getAppBaseUrl({ NEXTAUTH_URL: '  ' })).toBe('http://localhost:3000');
  });
});
