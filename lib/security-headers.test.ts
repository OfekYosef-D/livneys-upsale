import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, securityResponseHeaders } from './security-headers';

describe('production security headers', () => {
  it('builds a nonce-based CSP without unsafe inline scripts', () => {
    const policy = buildContentSecurityPolicy('nonce-value', false);

    expect(policy).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic' https://challenges.cloudflare.com");
    expect(policy).not.toContain("script-src 'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("img-src 'self' data: blob: https:");
    expect(policy).not.toContain("img-src 'self' data: blob: https: http:");
  });

  it('enables eval only for the Next.js development runtime', () => {
    expect(buildContentSecurityPolicy('dev-nonce', true)).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy('dev-nonce', true)).toContain("img-src 'self' data: blob: https: http:");
  });

  it('sets clickjacking, MIME, referrer, permissions, and transport protections', () => {
    expect(securityResponseHeaders).toMatchObject({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Strict-Transport-Security': expect.stringContaining('max-age='),
    });
    expect(securityResponseHeaders['Permissions-Policy']).toContain('camera=()');
  });
});
