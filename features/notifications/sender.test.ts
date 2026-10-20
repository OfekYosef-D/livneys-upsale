import { describe, expect, it, vi } from 'vitest';
import { getWhatsAppConfig } from './config';
import { PermanentDeliveryError } from './delivery';
import { buildWhatsAppTemplateRequest, sendWhatsAppTemplate } from './sender';

const liveConfig = getWhatsAppConfig({
  WHATSAPP_SEND_ENABLED: 'true',
  WHATSAPP_ACCESS_TOKEN: 'token',
  WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
});

const message: { to: string; templateName: string | null; languageCode: string; bodyParameters: Array<{ name: string; text: string }> } = {
  to: '+972501234567',
  templateName: 'livneys_order_received_he',
  languageCode: 'he',
  bodyParameters: [{ name: 'customer_name', text: 'דנה' }],
};

function metaResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function sendWith(fetchImpl: ReturnType<typeof vi.fn>, overrides: Partial<typeof message> = {}, config = liveConfig) {
  return sendWhatsAppTemplate({ ...message, ...overrides }, { config, fetchImpl: fetchImpl as never });
}

describe('buildWhatsAppTemplateRequest', () => {
  it('builds Meta template payloads with named body parameters and a bare recipient number', () => {
    expect(
      buildWhatsAppTemplateRequest({
        to: '+972501234567',
        templateName: 'livneys_order_received_heb',
        languageCode: 'he',
        bodyParameters: [
          { name: 'customer_name', text: 'Dana' },
          { name: 'order_id', text: '#1' },
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
              { type: 'text', parameter_name: 'order_id', text: '#1' },
            ],
          },
        ],
      },
    });
  });

  it('supports positional body parameters', () => {
    expect(
      buildWhatsAppTemplateRequest({ ...message, templateName: 'positional_template', bodyParameters: ['Dana', '#1'] }).template.components[0].parameters,
    ).toEqual([
      { type: 'text', text: 'Dana' },
      { type: 'text', text: '#1' },
    ]);
  });
});

describe('sendWhatsAppTemplate', () => {
  it('does not call Meta when sending is disabled', async () => {
    const fetchImpl = vi.fn();
    await expect(sendWith(fetchImpl, { templateName: null }, getWhatsAppConfig({})))
      .resolves.toEqual({ mode: 'dry-run', providerMessageId: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails permanently when enabled without provider credentials', async () => {
    const fetchImpl = vi.fn();
    await expect(sendWith(fetchImpl, {}, getWhatsAppConfig({ WHATSAPP_SEND_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'token' })))
      .rejects.toBeInstanceOf(PermanentDeliveryError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails permanently when no template is configured for the message', async () => {
    const fetchImpl = vi.fn();
    await expect(sendWith(fetchImpl, { templateName: null })).rejects.toBeInstanceOf(PermanentDeliveryError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts the template to the configured phone number id and returns the message id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(metaResponse(200, { messages: [{ id: 'wamid.123' }] }));

    await expect(sendWith(fetchImpl)).resolves.toEqual({ mode: 'live', providerMessageId: 'wamid.123' });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v25.0/phone-id/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer token');
    expect(JSON.parse(init.body)).toMatchObject({
      to: '972501234567',
      template: { name: 'livneys_order_received_he', language: { code: 'he' } },
    });
  });

  it('treats a success response without a message id as retryable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(metaResponse(200, { messages: [] }));
    const error = await sendWith(fetchImpl).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PermanentDeliveryError);
  });

  it('keeps 5xx Meta errors retryable and includes provider diagnostics', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(metaResponse(500, {
      error: {
        message: 'Service temporarily unavailable',
        code: 2,
        error_subcode: 99,
        fbtrace_id: 'trace-1',
        error_data: { details: ' try later ' },
      },
    }));

    const error = await sendWith(fetchImpl).catch((e: unknown) => e) as Error;
    expect(error).not.toBeInstanceOf(PermanentDeliveryError);
    expect(error.message).toBe(
      'Meta WhatsApp API error (HTTP 500, code 2, subcode 99, trace trace-1): Service temporarily unavailable Details: try later',
    );
  });

  it('retries 4xx errors flagged transient or with code 131000', async () => {
    for (const error of [{ code: 100, is_transient: true }, { code: 131000 }]) {
      const fetchImpl = vi.fn().mockResolvedValue(metaResponse(400, { error }));
      const failure = await sendWith(fetchImpl).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(Error);
      expect(failure).not.toBeInstanceOf(PermanentDeliveryError);
    }
  });

  it('does not retry other 4xx errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(metaResponse(400, { error: { message: 'Template name does not exist', code: 132001 } }));
    const failure = await sendWith(fetchImpl).catch((e: unknown) => e) as Error;
    expect(failure).toBeInstanceOf(PermanentDeliveryError);
    expect(failure.message).toContain('code 132001');
  });

  it('describes non-JSON failures by HTTP status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => { throw new Error('not json'); } });
    const failure = await sendWith(fetchImpl).catch((e: unknown) => e) as Error;
    expect(failure).toBeInstanceOf(PermanentDeliveryError);
    expect(failure.message).toBe('Meta WhatsApp API request failed with HTTP 401');
  });
});
