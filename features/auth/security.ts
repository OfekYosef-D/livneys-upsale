import { createHash, randomBytes } from 'node:crypto';
export { BCRYPT_MAX_PASSWORD_BYTES, isBcryptPasswordLengthSafe } from './password-policy';

export const BCRYPT_ROUNDS = 12;

/** Compared against when the account does not exist, so response time does not reveal which emails are registered. */
export const DUMMY_PASSWORD_HASH = '$2b$12$lyBsPWU.S81FtafGOY3Or.lwCiOJSeIFoQAVRLMFCma6qvYPCK2Zy';

export function createRawAuthToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAuthToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sanitizeInternalNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/api/auth')) return fallback;

  try {
    const parsed = new URL(value, 'https://internal.invalid');
    if (parsed.origin !== 'https://internal.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
