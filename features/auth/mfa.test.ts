import { describe, expect, it } from 'vitest';
import { decryptMfaSecret, encryptMfaSecret, generateRecoveryCodes, generateTotpCode, verifyTotpCode } from './mfa';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');

describe('admin MFA', () => {
  it('encrypts TOTP secrets at rest', () => {
    const encrypted = encryptMfaSecret('JBSWY3DPEHPK3PXP', encryptionKey);
    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptMfaSecret(encrypted, encryptionKey)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('verifies time-based codes with a one-step clock window', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const now = new Date('2026-08-11T12:00:00.000Z');
    const code = generateTotpCode(secret, now);
    expect(verifyTotpCode(secret, code, now)).toBe(true);
    expect(verifyTotpCode(secret, '000000', now)).toBe(false);
  });

  it('generates distinct one-time recovery codes', () => {
    const codes = generateRecoveryCodes(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    expect(codes.every((code) => /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code))).toBe(true);
  });
});
