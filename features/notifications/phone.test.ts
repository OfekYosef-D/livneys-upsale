import { describe, expect, it } from 'vitest';
import { normalizePhoneToE164 } from './phone';

describe('normalizePhoneToE164', () => {
  it('normalizes Israeli local and international phone formats', () => {
    expect(normalizePhoneToE164('050-123-4567')).toBe('+972501234567');
    expect(normalizePhoneToE164('+972 50 123 4567')).toBe('+972501234567');
    expect(normalizePhoneToE164('972501234567')).toBe('+972501234567');
    expect(normalizePhoneToE164('00972501234567')).toBe('+972501234567');
  });

  it('rejects values that are not valid E.164 phone numbers', () => {
    expect(normalizePhoneToE164('')).toBeNull();
    expect(normalizePhoneToE164('abc')).toBeNull();
    expect(normalizePhoneToE164('123')).toBeNull();
  });
});
