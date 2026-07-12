import { describe, expect, it, vi } from 'vitest';
import { getWhatsAppConfig } from './config';
import { buildWhatsAppTemplateRequest, PermanentWhatsAppError, sendWhatsAppTemplate } from './sender';

describe('WhatsApp sender', () => {
  it('builds Meta template payloads with named body parameters', () => {
    expect(
      buildWhatsAppTemplateRequest({
        to: '+972501234567',
        templateName: 'livneys_order_received_heb',
        languageCode: 'he',
        bodyParameters: [
          { name: 'customer_name', text: 'Dana' },
          { name: 'order_id', text: 'ORD-1' },
        ],
      }),
    ).toEqual({
      messaging_product: 'whatsapp',
      to: '972501234567',
      type: 'template',
      template: {
        name: 'livneys_order_received_heb',
        language: { code: 'he' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', parameter_name: 'customer_name', text: 'Dana' },
              { type: 'text', parameter_name: 'order_id', text: 'ORD-1' },
            ],
          },
        ],
      },
    });
  });

  it('keeps legacy positional body parameters compatible with existing queued jobs', () => {
    expect(
      buildWhatsAppTemplateRequest({
        to: '+972501234567',
        templateName: 'legacy_template',
        languageCode: 'he',
        bodyParameters: ['Dana', 'ORD-1'],
      }).template.components[0].parameters,
    ).toEqual([
      { type: 'text', text: 'Dana' },
      { type: 'text', text: 'ORD-1' },
    ]);
  });

  it('does not call Meta in dry-run mode', async () => {
    const fetchMock = vi.fn();
    const result = await sendWhatsAppTemplate(
      {
        to: '+972501234567',
        templateName: null,
        templateKey: 'ORDER_RECEIVED',
        languageCode: 'he',
        bodyParameters: ['Cafe South'],
      },
      {
        config: getWhatsAppConfig({ WHATSAPP_SEND_ENABLED: 'false' }),
        fetchImpl: fetchMock,
      },
    );

    expect(result).toEqual({
      mode: 'dry-run',
      providerMessageId: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends template requests to the configured Meta phone number id when enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.123' }] }),
    });

    const result = await sendWhatsAppTemplate(
      {
        to: '+972501234567',
        templateName: 'livneys_order_received_he',
        templateKey: 'ORDER_RECEIVED',
        languageCode: 'he',
        bodyParameters: ['Cafe South'],
      },
      {
        config: getWhatsAppConfig({
          WHATSAPP_SEND_ENABLED: 'true',
          WHATSAPP_ACCESS_TOKEN: 'token',
          WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
        }),
        fetchImpl: fetchMock,
      },
    );

    expect(result).toEqual({
      mode: 'live',
      providerMessageId: 'wamid.123',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/phone-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    );
  });

  it('keeps transient Meta errors retryable and includes provider diagnostics', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          message: '(#131000) Something went wrong',
          type: 'OAuthException',
          code: 131000,
          is_transient: true,
          fbtrace_id: 'trace-123',
        },
      }),
    });

    await expect(
      sendWhatsAppTemplate(
        {
          to: '+972501234567',
          templateName: 'jaspers_market_order_confirmation_v1',
          templateKey: 'ORDER_RECEIVED',
          languageCode: 'en_US',
          bodyParameters: ['Dana', 'ord-1', '01/07/2026'],
        },
        {
          config: getWhatsAppConfig({
            WHATSAPP_SEND_ENABLED: 'true',
            WHATSAPP_ACCESS_TOKEN: 'token',
            WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
          }),
          fetchImpl: fetchMock,
        },
      ),
    ).rejects.toThrow('Meta WhatsApp API error 131000');

    await expect(
      sendWhatsAppTemplate(
        {
          to: '+972501234567',
          templateName: 'jaspers_market_order_confirmation_v1',
          templateKey: 'ORDER_RECEIVED',
          languageCode: 'en_US',
          bodyParameters: ['Dana', 'ord-1', '01/07/2026'],
        },
        {
          config: getWhatsAppConfig({
            WHATSAPP_SEND_ENABLED: 'true',
            WHATSAPP_ACCESS_TOKEN: 'token',
            WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
          }),
          fetchImpl: fetchMock,
        },
      ),
    ).rejects.not.toBeInstanceOf(PermanentWhatsAppError);
  });

  it('keeps permanent Meta request errors from retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: '(#131030) Recipient phone number not in allowed list',
          type: 'OAuthException',
          code: 131030,
          fbtrace_id: 'trace-456',
        },
      }),
    });

    await expect(
      sendWhatsAppTemplate(
        {
          to: '+972501234567',
          templateName: 'jaspers_market_order_confirmation_v1',
          templateKey: 'ORDER_RECEIVED',
          languageCode: 'en_US',
          bodyParameters: ['Dana', 'ord-1', '01/07/2026'],
        },
        {
          config: getWhatsAppConfig({
            WHATSAPP_SEND_ENABLED: 'true',
            WHATSAPP_ACCESS_TOKEN: 'token',
            WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
          }),
          fetchImpl: fetchMock,
        },
      ),
    ).rejects.toBeInstanceOf(PermanentWhatsAppError);
  });
});
