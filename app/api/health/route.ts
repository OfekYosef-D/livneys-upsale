import { checkApplicationHealth } from '../../../features/deployment/health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const result = await checkApplicationHealth();
  return Response.json(result, {
    status: result.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
