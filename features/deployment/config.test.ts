import { describe, expect, it } from 'vitest';
import { parseDeploymentEnv } from './config';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@ep-example-pooler.eu-central-1.aws.neon.tech/app?sslmode=require',
  DIRECT_URL: 'postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/app?sslmode=require',
  NEXTAUTH_SECRET: 'a'.repeat(32),
  NEXTAUTH_URL: 'https://livneys-upsale.vercel.app',
  CRON_SECRET: 'b'.repeat(16),
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'turnstile-site',
  RESEND_API_KEY: 're_test',
  EMAIL_FROM: "Livney's <orders@example.com>",
  WHATSAPP_SEND_ENABLED: 'false',
};

describe('parseDeploymentEnv', () => {
  it('accepts the complete dry-run deployment environment', () => {
    const result = parseDeploymentEnv(validEnv);

    expect(result.whatsappSendEnabled).toBe(false);
    expect(result.nextAuthUrl).toBe('https://livneys-upsale.vercel.app');
  });

  it('rejects missing core deployment secrets without including secret values', () => {
    expect(() => parseDeploymentEnv({ ...validEnv, NEXTAUTH_SECRET: '' })).toThrow('NEXTAUTH_SECRET');
  });

  it('requires Meta credentials when live WhatsApp sending is enabled', () => {
    expect(() => parseDeploymentEnv({ ...validEnv, WHATSAPP_SEND_ENABLED: 'true' })).toThrow('WHATSAPP_ACCESS_TOKEN');
  });

  it('blocks a production deployment until the current legal document version is approved', () => {
    expect(() => parseDeploymentEnv({ ...validEnv, VERCEL_ENV: 'production' })).toThrow('LEGAL_DOCUMENTS_APPROVED_VERSION');
    expect(() => parseDeploymentEnv({
      ...validEnv,
      VERCEL_ENV: 'production',
      LEGAL_DOCUMENTS_APPROVED_VERSION: '2026-08-12-review',
    })).not.toThrow();
  });
});
