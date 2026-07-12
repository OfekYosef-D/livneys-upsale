import { getWhatsAppConfig } from '../../../../features/notifications/config';
import { processDueNotifications } from '../../../../features/notifications/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleCronRequest(request);
}

export async function POST(request: Request) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: Request): Promise<Response> {
  const config = getWhatsAppConfig();

  if (!config.cronSecret) {
    return Response.json({ ok: false, error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${config.cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processDueNotifications({ config });
  return Response.json({ ok: true, ...result });
}
