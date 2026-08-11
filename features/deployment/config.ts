import { z } from 'zod';

type EnvLike = Record<string, string | undefined>;

const postgresUrl = z.string().trim().url().refine(
  (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
  'must be a PostgreSQL connection URL',
);

const deploymentEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl,
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().trim().url(),
  CRON_SECRET: z.string().min(16),
  MFA_ENCRYPTION_KEY: z.string().refine((value) => {
    try { return Buffer.from(value, 'base64').length === 32; } catch { return false; }
  }, 'must be a base64-encoded 32-byte key'),
  TURNSTILE_SECRET_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().trim().min(1),
  WHATSAPP_SEND_ENABLED: z.enum(['true', 'false', '1', '0']).default('false'),
  WHATSAPP_ACCESS_TOKEN: z.string().trim().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().trim().optional(),
  WHATSAPP_APP_SECRET: z.string().trim().optional(),
}).superRefine((env, context) => {
  if (env.WHATSAPP_SEND_ENABLED !== 'true' && env.WHATSAPP_SEND_ENABLED !== '1') return;

  for (const key of ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET'] as const) {
    if (!env[key]) {
      context.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} is required when live WhatsApp sending is enabled`,
      });
    }
  }
});

export type DeploymentEnv = {
  databaseUrl: string;
  directUrl: string;
  nextAuthSecret: string;
  nextAuthUrl: string;
  cronSecret: string;
  whatsappSendEnabled: boolean;
  mfaEncryptionKey: string;
  turnstileConfigured: boolean;
};

export function parseDeploymentEnv(env: EnvLike): DeploymentEnv {
  const parsed = deploymentEnvSchema.parse(env);

  return {
    databaseUrl: parsed.DATABASE_URL,
    directUrl: parsed.DIRECT_URL,
    nextAuthSecret: parsed.NEXTAUTH_SECRET,
    nextAuthUrl: parsed.NEXTAUTH_URL,
    cronSecret: parsed.CRON_SECRET,
    whatsappSendEnabled: parsed.WHATSAPP_SEND_ENABLED === 'true' || parsed.WHATSAPP_SEND_ENABLED === '1',
    mfaEncryptionKey: parsed.MFA_ENCRYPTION_KEY,
    turnstileConfigured: Boolean(parsed.TURNSTILE_SECRET_KEY && parsed.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  };
}
