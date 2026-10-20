import { AuthTokenType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import type { TransactionClient } from '@/lib/transactions';
import { createRawAuthToken, hashAuthToken } from './security';

const tokenTtlMs: Record<AuthTokenType, number> = {
  PASSWORD_SETUP: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
};

export class InvalidAuthTokenError extends AppError {
  constructor() {
    super('INVALID_TOKEN', 'הקישור אינו תקף או שפג תוקפו. בקשו קישור חדש.');
  }
}

export function issueAuthToken(input: { userId: string; type: AuthTokenType; baseUrl: string; now?: Date }) {
  return prisma.$transaction((tx) => issueAuthTokenInTransaction(tx, input));
}

/**
 * Only a hash is stored. Tokens are bound to the user's sessionVersion, so any password change
 * or deactivation silently invalidates every outstanding link.
 */
export async function issueAuthTokenInTransaction(
  tx: TransactionClient,
  { userId, type, baseUrl, now = new Date() }: { userId: string; type: AuthTokenType; baseUrl: string; now?: Date },
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { sessionVersion: true, isActive: true, role: true, passwordHash: true, customer: { select: { isActive: true } } },
  });
  if (
    !user
    || !user.isActive
    || (user.role === 'CUSTOMER' && !user.customer?.isActive)
    || (type === 'PASSWORD_SETUP' && user.passwordHash)
  ) {
    throw new InvalidAuthTokenError();
  }

  const rawToken = createRawAuthToken();
  const expiresAt = new Date(now.getTime() + tokenTtlMs[type]);
  const record = await tx.authToken.create({
    data: { userId, type, tokenHash: hashAuthToken(rawToken), expiresAt, sessionVersion: user.sessionVersion },
  });

  const url = new URL(type === 'PASSWORD_SETUP' ? '/setup-password' : '/reset-password', baseUrl);
  url.searchParams.set('token', rawToken);
  return { tokenId: record.id, rawToken, url: url.toString(), expiresAt };
}

const tokenRecordInclude = { user: { include: { customer: { select: { isActive: true } } } } } as const;
type TokenRecord = Prisma.AuthTokenGetPayload<{ include: typeof tokenRecordInclude }>;

function assertUsable(record: TokenRecord | null, type: AuthTokenType, now: Date): asserts record is TokenRecord {
  if (
    !record
    || record.type !== type
    || record.usedAt
    || record.expiresAt <= now
    || !record.user.isActive
    || record.sessionVersion !== record.user.sessionVersion
    || (record.user.role === 'CUSTOMER' && !record.user.customer?.isActive)
  ) {
    throw new InvalidAuthTokenError();
  }
}

/** Cheap pre-check before hashing the new password. */
export async function assertPasswordTokenUsable({ token, type, now = new Date() }: { token: string; type: AuthTokenType; now?: Date }) {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashAuthToken(token) }, include: tokenRecordInclude });
  assertUsable(record, type, now);
}

/** Single-use: sets the password, revokes every other open link and signs out all sessions. */
export function consumePasswordToken({
  token,
  type,
  passwordHash,
  now = new Date(),
}: {
  token: string;
  type: AuthTokenType;
  passwordHash: string;
  now?: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.authToken.findUnique({ where: { tokenHash: hashAuthToken(token) }, include: tokenRecordInclude });
    assertUsable(record, type, now);

    const claimed = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new InvalidAuthTokenError();

    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: now, sessionVersion: { increment: 1 } },
    });
    await tx.authToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } });
    return { userId: record.userId, role: record.user.role, customerId: record.user.customerId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
