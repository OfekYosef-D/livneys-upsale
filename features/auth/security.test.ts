import { describe, expect, it } from 'vitest';
import { hashAuthToken, passwordSchema, sanitizeInternalNextPath } from './security';

describe('authentication security helpers', () => {
  it('requires a strong password', () => {
    expect(passwordSchema.safeParse('StrongPass!2026').success).toBe(true);
    expect(passwordSchema.safeParse('livneys-demo').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercasepassword1!').success).toBe(false);
    expect(passwordSchema.safeParse(`Aa1!${'א'.repeat(35)}`).success).toBe(false);
  });

  it('hashes raw authentication tokens before persistence', () => {
    const raw = 'raw-one-time-token';
    expect(hashAuthToken(raw)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAuthToken(raw)).not.toContain(raw);
  });

  it('allows only internal non-authentication next paths', () => {
    expect(sanitizeInternalNextPath('/admin/orders/1042', '/admin')).toBe('/admin/orders/1042');
    expect(sanitizeInternalNextPath('https://evil.example', '/admin')).toBe('/admin');
    expect(sanitizeInternalNextPath('//evil.example', '/admin')).toBe('/admin');
    expect(sanitizeInternalNextPath('/api/auth/signout', '/admin')).toBe('/admin');
  });
});
