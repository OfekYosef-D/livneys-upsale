import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

vi.mock('../../../../features/notifications/webhooks', () => ({
  processWhatsAppWebhookPayload: vi.fn(),
  verifyWhatsAppWebhookSignature: vi.fn(),
}));

const { processWhatsAppWebhookPayload, verifyWhatsAppWebhookSignature } = await import('../../../../features/notifications/webhooks');
const mockedProcessWhatsAppWebhookPayload = vi.mocked(processWhatsAppWebhookPayload);
const mockedVerifyWhatsAppWebhookSignature = vi.mocked(verifyWhatsAppWebhookSignature);

describe('/api/webhooks/whatsapp', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-token';
    process.env.WHATSAPP_APP_SECRET = 'app-secret';
    process.env.WHATSAPP_SEND_ENABLED = 'false';
    mockedProcessWhatsAppWebhookPayload.mockReset();
    mockedVerifyWhatsAppWebhookSignature.mockReset();
    mockedVerifyWhatsAppWebhookSignature.mockReturnValue(true);
  });

  it('returns the Meta challenge when verification token matches', async () => {
    const response = await GET(new Request('https://orders.example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=abc123'));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('abc123');
  });

  it('rejects invalid webhook verification tokens', async () => {
    const response = await GET(new Request('https://orders.example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=abc123'));

    expect(response.status).toBe(403);
  });

  it('validates signatures and processes webhook payloads', async () => {
    const response = await POST(
      new Request('https://orders.example.com/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'X-Hub-Signature-256': 'sha256=valid' },
        body: '{"entry":[]}',
      }),
    );

    expect(response.status).toBe(200);
    expect(mockedVerifyWhatsAppWebhookSignature).toHaveBeenCalledWith('{"entry":[]}', 'sha256=valid', 'app-secret');
    expect(mockedProcessWhatsAppWebhookPayload).toHaveBeenCalledWith({ entry: [] });
  });

  it('fails safely when live WhatsApp mode is enabled without an app secret', async () => {
    process.env.WHATSAPP_SEND_ENABLED = 'true';
    process.env.WHATSAPP_APP_SECRET = '';

    const response = await POST(
      new Request('https://orders.example.com/api/webhooks/whatsapp', {
        method: 'POST',
        body: '{"entry":[]}',
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'WHATSAPP_APP_SECRET is required when live WhatsApp sending or production mode is enabled',
    });
    expect(mockedProcessWhatsAppWebhookPayload).not.toHaveBeenCalled();
  });

  it('allows unsigned webhook posts in dry-run mode when no app secret is configured', async () => {
    process.env.WHATSAPP_SEND_ENABLED = 'false';
    process.env.WHATSAPP_APP_SECRET = '';

    const response = await POST(
      new Request('https://orders.example.com/api/webhooks/whatsapp', {
        method: 'POST',
        body: '{"entry":[]}',
      }),
    );

    expect(response.status).toBe(200);
    expect(mockedVerifyWhatsAppWebhookSignature).not.toHaveBeenCalled();
    expect(mockedProcessWhatsAppWebhookPayload).toHaveBeenCalledWith({ entry: [] });
  });

  it('fails safely in production without an app secret even when sending is dry-run', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.WHATSAPP_SEND_ENABLED = 'false';
    process.env.WHATSAPP_APP_SECRET = '';

    const response = await POST(
      new Request('https://orders.example.com/api/webhooks/whatsapp', {
        method: 'POST',
        body: '{"entry":[]}',
      }),
    );

    expect(response.status).toBe(503);
    expect(mockedProcessWhatsAppWebhookPayload).not.toHaveBeenCalled();
  });
});
