import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/db';

const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

type RateLimitScope =
  | 'login-ip'
  | 'login-account'
  | 'password-reset-ip'
  | 'password-reset-account'
  | 'registration-ip'
  | 'registration-account';

export class RateLimitError extends Error {
  readonly code = 'RATE_LIMITED';

  constructor() {
    super('יותר מדי ניסיונות. נסו שוב מאוחר יותר.');
    this.name = 'RateLimitError';
  }
}

export async function consumeRateLimit({
  scope,
  identifier,
  limit,
  windowMs,
  blockMs = windowMs,
  now = new Date(),
}: {
  scope: RateLimitScope;
  identifier: string;
  limit: number;
  windowMs: number;
  blockMs?: number;
  now?: Date;
}) {
  await prisma.rateLimitBucket.deleteMany({
    where: { updatedAt: { lt: new Date(now.getTime() - RATE_LIMIT_RETENTION_MS) } },
  });

  const key = `${scope}:${createHash('sha256').update(identifier.toLowerCase()).digest('hex')}`;
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
  return { key, remaining: Math.max(0, limit - result.count) };
}

export async function clearRateLimit(scope: RateLimitScope, identifier: string) {
  const key = `${scope}:${createHash('sha256').update(identifier.toLowerCase()).digest('hex')}`;
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}
