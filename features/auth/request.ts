import { headers } from 'next/headers';

export async function getRequestIp(): Promise<string> {
  const values = await headers();
  const forwarded = values.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || values.get('x-real-ip')?.trim() || 'unknown';
}

export async function getRequestBaseUrl(): Promise<string> {
  const values = await headers();
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) return configured;
  const host = values.get('x-forwarded-host') || values.get('host');
  const protocol = values.get('x-forwarded-proto') || 'http';
  return host ? `${protocol}://${host}` : 'http://localhost:3000';
}
