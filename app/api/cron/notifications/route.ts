import { timingSafeEqual } from 'node:crypto';
import { processDueNotifications } from '@/features/notifications/jobs';
import { generateDueReminders } from '@/features/notifications/reminders';
import { advanceRouteSchedules } from '@/features/routes/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Daily job (see vercel.json): roll route schedules, queue reminders, deliver/retry queued messages. */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return Response.json({ ok: false, error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (!isAuthorized(request.headers.get('authorization'), secret)) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const routes = await advanceRouteSchedules(now);
  const reminders = await generateDueReminders({ now });
  const delivery = await processDueNotifications({ now });
  return Response.json({ ok: true, routes, reminders, delivery });
}

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? '');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const GET = handle;
export const POST = handle;
