import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';

const MINUTE = 60 * 1000;
const RETENTION_MS = 24 * 60 * MINUTE;

type Policy = { limit: number; windowMs: number; blockMs: number };

/** Per-IP limits stop broad abuse; per-account limits stop targeted guessing. */
const policies = {
  'login-ip': { limit: 40, windowMs: 15 * MINUTE, blockMs: 30 * MINUTE },
  'login-account': { limit: 8, windowMs: 15 * MINUTE, blockMs: 30 * MINUTE },
  'password-reset-ip': { limit: 20, windowMs: 30 * MINUTE, blockMs: 60 * MINUTE },
  'password-reset-account': { limit: 4, windowMs: 30 * MINUTE, blockMs: 60 * MINUTE },
  'mfa-replacement-ip': { limit: 20, windowMs: 30 * MINUTE, blockMs: 60 * MINUTE },
  'mfa-replacement-account': { limit: 8, windowMs: 30 * MINUTE, blockMs: 60 * MINUTE },
  'registration-ip': { limit: 10, windowMs: 60 * MINUTE, blockMs: 6 * 60 * MINUTE },
  'registration-account': { limit: 3, windowMs: 60 * MINUTE, blockMs: 6 * 60 * MINUTE },
} satisfies Record<string, Policy>;

export type RateLimitScope = keyof typeof policies;

export class RateLimitError extends AppError {
  constructor() {
    super('RATE_LIMITED', 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.');
  }
}

/** Buckets store a hash, never the raw email or IP. */
function bucketKey(scope: RateLimitScope, identifier: string): string {
  return `${scope}:${createHash('sha256').update(identifier.toLowerCase()).digest('hex')}`;
}

/** Counts one attempt in a fixed window, atomically in the database (works across serverless instances). */
export async function consumeRateLimit(scope: RateLimitScope, identifier: string, now: Date = new Date()) {
  const { limit, windowMs, blockMs } = policies[scope];
  await prisma.rateLimitBucket.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - RETENTION_MS) } } });

  const key = bucketKey(scope, identifier);
  const windowThreshold = new Date(now.getTime() - windowMs);
  const newBlockedUntil = new Date(now.getTime() + blockMs);
  const rows = await prisma.$queryRaw<Array<{ count: number; blockedUntil: Date | null }>>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "blockedUntil", "updatedAt")
    VALUES (${key}, 1, ${now}, NULL, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStart" <= ${windowThreshold} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitBucket"."windowStart" <= ${windowThreshold} THEN ${now}
        ELSE "RateLimitBucket"."windowStart"
      END,
      "blockedUntil" = CASE
        WHEN "RateLimitBucket"."blockedUntil" > ${now} THEN "RateLimitBucket"."blockedUntil"
        WHEN (CASE WHEN "RateLimitBucket"."windowStart" <= ${windowThreshold} THEN 1 ELSE "RateLimitBucket"."count" + 1 END) > ${limit}
          THEN ${newBlockedUntil}
        ELSE NULL
      END,
      "updatedAt" = ${now}
    RETURNING "count", "blockedUntil"
  `);
  const result = rows[0];
  if (!result || (result.blockedUntil && result.blockedUntil > now)) throw new RateLimitError();
  return { remaining: Math.max(0, limit - result.count) };
}

export async function clearRateLimit(scope: RateLimitScope, identifier: string) {
  await prisma.rateLimitBucket.deleteMany({ where: { key: bucketKey(scope, identifier) } });
}
