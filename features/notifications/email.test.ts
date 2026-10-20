import { describe, expect, it, vi } from 'vitest';
import { PermanentDeliveryError } from './delivery';
import { getEmailConfig, isEmailConfigured, renderRtlHtml, sendEmailMessage } from './email';

const message = { to: 'client@example.com', subject: 'עדכון', text: 'שלום\nלצפייה: https://orders.example.com/customer/c1' };
const liveConfig = getEmailConfig({ RESEND_API_KEY: 're_key', EMAIL_FROM: "Livney's <orders@example.com>", EMAIL_REPLY_TO: 'support@example.com' });

function response(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('email config', () => {
  it('is configured only with both an API key and a sender', () => {
    expect(isEmailConfigured(getEmailConfig({}))).toBe(false);
    expect(isEmailConfigured(getEmailConfig({ RESEND_API_KEY: 're_key' }))).toBe(false);
    expect(isEmailConfigured(getEmailConfig({ EMAIL_FROM: 'a@example.com' }))).toBe(false);
    expect(isEmailConfigured(liveConfig)).toBe(true);
  });
});

describe('sendEmailMessage', () => {
  it('is a dry run when Resend is not configured', async () => {
    const fetchImpl = vi.fn();
    await expect(sendEmailMessage(message, { config: getEmailConfig({ EMAIL_FROM: 'a@example.com' }), fetchImpl: fetchImpl as never }))
      .resolves.toEqual({ mode: 'dry-run', providerMessageId: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends through Resend with an RTL html body and returns the provider id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, { id: 'email-001' }));

    await expect(sendEmailMessage(message, { config: liveConfig, fetchImpl: fetchImpl as never }))
      .resolves.toEqual({ mode: 'live', providerMessageId: 'email-001' });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: "Livney's <orders@example.com>",
      to: ['client@example.com'],
      reply_to: 'support@example.com',
      subject: 'עדכון',
      text: message.text,
    });
    expect(body.html).toContain('dir="rtl"');
    expect(body.html).toContain('<a href="https://orders.example.com/customer/c1" dir="ltr">');
  });

  it('omits reply_to when not configured and tolerates a missing id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {}));
    const config = getEmailConfig({ RESEND_API_KEY: 're_key', EMAIL_FROM: 'a@example.com' });

    await expect(sendEmailMessage(message, { config, fetchImpl: fetchImpl as never }))
      .resolves.toEqual({ mode: 'live', providerMessageId: null });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).not.toHaveProperty('reply_to');
  });

  it.each([400, 403, 422])('treats HTTP %s as a permanent failure', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(response(status));
    await expect(sendEmailMessage(message, { config: liveConfig, fetchImpl: fetchImpl as never }))
      .rejects.toBeInstanceOf(PermanentDeliveryError);
  });

  it.each([429, 500, 503])('treats HTTP %s as a retryable failure', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(response(status));
    const error = await sendEmailMessage(message, { config: liveConfig, fetchImpl: fetchImpl as never }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(PermanentDeliveryError);
    expect((error as Error).message).toContain(String(status));
  });
});

describe('renderRtlHtml', () => {
  it('escapes HTML and converts newlines', () => {
    const html = renderRtlHtml('<b>"שלום" & ברוכים</b>\nשורה 2');
    expect(html).toContain('&lt;b&gt;&quot;שלום&quot; &amp; ברוכים&lt;/b&gt;<br>שורה 2');
    expect(html.startsWith('<div dir="rtl"')).toBe(true);
  });
});
