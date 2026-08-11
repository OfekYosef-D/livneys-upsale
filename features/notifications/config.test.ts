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
      'ORDER_ADDITION_APPROVED',
      'ORDER_ADDITION_REJECTED',
      'PASSWORD_SETUP',
      'PASSWORD_RESET',
    ]);
  });

  it('resolves addition decision templates', () => {
    const config = getWhatsAppConfig({
      WHATSAPP_TEMPLATE_ORDER_ADDITION_APPROVED: 'livneys_addition_approved_he',
      WHATSAPP_TEMPLATE_ORDER_ADDITION_REJECTED: 'livneys_addition_rejected_he',
    });

    expect(resolveWhatsAppTemplateName('ORDER_ADDITION_APPROVED', config)).toBe('livneys_addition_approved_he');
    expect(resolveWhatsAppTemplateName('ORDER_ADDITION_REJECTED', config)).toBe('livneys_addition_rejected_he');
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
