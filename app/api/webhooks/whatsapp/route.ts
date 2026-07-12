import { getWhatsAppConfig } from '../../../../features/notifications/config';
import {
  processWhatsAppWebhookPayload,
  verifyWhatsAppWebhookSignature,
} from '../../../../features/notifications/webhooks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const config = getWhatsAppConfig();
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === config.webhookVerifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}

export async function POST(request: Request): Promise<Response> {
  const config = getWhatsAppConfig();
  const requiresSignature = config.sendEnabled || process.env.NODE_ENV === 'production';

  if (requiresSignature && !config.appSecret) {
    return Response.json(
      { ok: false, error: 'WHATSAPP_APP_SECRET is required when live WhatsApp sending or production mode is enabled' },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  if (config.appSecret && !verifyWhatsAppWebhookSignature(rawBody, signature, config.appSecret)) {
    return Response.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  await processWhatsAppWebhookPayload(payload);
  return Response.json({ ok: true });
}
