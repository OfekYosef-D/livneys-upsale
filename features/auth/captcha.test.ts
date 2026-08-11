import { describe, expect, it, vi } from 'vitest';
import { verifyRegistrationChallenge } from './captcha';

describe('registration bot protection', () => {
  it('rejects a filled honeypot before calling the provider', async () => {
    const fetchImpl = vi.fn();
    await expect(verifyRegistrationChallenge({
      ip: '127.0.0.1', honeypot: 'spam', token: 'token',
      env: { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'secret' },
      fetchImpl: fetchImpl as never,
    })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires and verifies Turnstile in production', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    await expect(verifyRegistrationChallenge({
      ip: '127.0.0.1', token: 'valid-token',
      env: { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'secret' },
      fetchImpl: fetchImpl as never,
    })).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
