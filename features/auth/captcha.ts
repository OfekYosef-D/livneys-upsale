export async function verifyRegistrationChallenge({
  token,
  ip,
  honeypot,
  env = process.env,
  fetchImpl = fetch,
}: {
  token?: string;
  ip: string;
  honeypot?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  if (honeypot?.trim()) return false;

  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return env.NODE_ENV !== 'production';
  if (!token?.trim()) return false;

  const form = new URLSearchParams({ secret, response: token, remoteip: ip });
  const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  if (!response.ok) return false;
  const payload = await response.json() as { success?: boolean };
  return payload.success === true;
}
