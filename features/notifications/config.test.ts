import { describe, expect, it } from 'vitest';
import {
  getWhatsAppConfig,
  resolveWhatsAppTemplateName,
  whatsappTemplateKeys,
} from './config';

describe('WhatsApp notification config', () => {
  it('defaults to dry-run mode with lifecycle template keys present', () => {
    const config = getWhatsAppConfig({});

    expect(config.sendEnabled).toBe(false);
    expect(config.graphApiVersion).toBe('v25.0');
    expect(whatsappTemplateKeys).toEqual([
      'ORDER_REMINDER',
      'ORDER_RECEIVED',
      'ORDER_APPROVED',
      'ORDER_PACKED',
      'ORDER_DELIVERED',
      'ORDER_CANCELLED',
      'ORDER_SPECIAL_REQUEST',
    ]);
  });

  it('resolves configured template names without requiring live sending', () => {
    const config = getWhatsAppConfig({
      WHATSAPP_SEND_ENABLED: 'false',
      WHATSAPP_TEMPLATE_ORDER_RECEIVED: 'livneys_order_received_he',
    });

    expect(resolveWhatsAppTemplateName('ORDER_RECEIVED', config)).toBe('livneys_order_received_he');
    expect(resolveWhatsAppTemplateName('ORDER_APPROVED', config)).toBeNull();
  });

  it('allows overriding the WhatsApp template language for Meta test templates', () => {
    const config = getWhatsAppConfig({
      WHATSAPP_TEMPLATE_LANGUAGE: 'en_US',
    });

    expect(config.templateLanguage).toBe('en_US');
  });
});
