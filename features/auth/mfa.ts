import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateMfaSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function generateTotpCode(secret: string, now = new Date(), offset = 0): string {
  const counter = Math.floor(now.getTime() / 30_000) + offset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const position = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[position] & 0x7f) << 24)
    | ((digest[position + 1] & 0xff) << 16)
    | ((digest[position + 2] & 0xff) << 8)
    | (digest[position + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, code: string, now = new Date()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((offset) => safeEqual(generateTotpCode(secret, now, offset), code));
}

export function encryptMfaSecret(secret: string, encodedKey = process.env.MFA_ENCRYPTION_KEY): string {
  const key = parseEncryptionKey(encodedKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptMfaSecret(value: string, encodedKey = process.env.MFA_ENCRYPTION_KEY): string {
  const key = parseEncryptionKey(encodedKey);
  const [ivText, tagText, encryptedText] = value.split('.');
  if (!ivText || !tagText || !encryptedText) throw new Error('MFA secret is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const value = randomBytes(8).toString('hex').toUpperCase();
    return `${value.slice(0, 8)}-${value.slice(8)}`;
  });
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseEncryptionKey(value: string | undefined): Buffer {
  if (!value) throw new Error('MFA encryption key is not configured.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('MFA encryption key must be 32 bytes encoded as base64.');
  return key;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeBase32(value: Buffer): string {
  let bits = '';
  for (const byte of value) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let index = 0; index < bits.length; index += 5) {
    result += base32Alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return result;
}

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = base32Alphabet.indexOf(character);
    if (index < 0) throw new Error('MFA secret is invalid.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}
