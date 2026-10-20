/** Client-safe password rules (no zod / node imports, so forms can show them without bundle cost). */

/** bcrypt silently ignores bytes beyond 72, so longer passwords are rejected instead of truncated. */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export function isBcryptPasswordLengthSafe(value: string): boolean {
  return new TextEncoder().encode(value).length <= BCRYPT_MAX_PASSWORD_BYTES;
}

/** Length over composition (NIST 800-63B): long passphrases are easier for customers and harder to guess. */
export const PASSWORD_HINT = 'לפחות 10 תווים, כולל אות ומספר. אפשר להשתמש במשפט קצר.';

export const MIN_PASSWORD_LENGTH = 10;
