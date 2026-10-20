import { describe, expect, it } from 'vitest';
import { passwordSchema } from './schema';
import { hashAuthToken, sanitizeInternalNextPath } from './security';

describe('authentication security helpers', () => {
  it('requires a long password with a letter and a digit, without composition rules', () => {
    expect(passwordSchema.safeParse('bakery jam 2026').success).toBe(true);
    expect(passwordSchema.safeParse('ממרח טעים 123').success).toBe(true);
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('no digits at all').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890').success).toBe(false);
    expect(passwordSchema.safeParse(`a1${'א'.repeat(40)}`).success).toBe(false);
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
