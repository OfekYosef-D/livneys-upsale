import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const passwordSchema = z.string()
  .min(12, 'הסיסמה חייבת להכיל לפחות 12 תווים.')
  .max(128, 'הסיסמה ארוכה מדי.')
  .regex(/[a-z]/, 'הסיסמה חייבת לכלול אות קטנה באנגלית.')
  .regex(/[A-Z]/, 'הסיסמה חייבת לכלול אות גדולה באנגלית.')
  .regex(/[0-9]/, 'הסיסמה חייבת לכלול ספרה.')
  .regex(/[^A-Za-z0-9]/, 'הסיסמה חייבת לכלול תו מיוחד.');

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
