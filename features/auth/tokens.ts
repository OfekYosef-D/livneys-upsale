import { AuthTokenType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/db';
import { createRawAuthToken, hashAuthToken } from './security';

const tokenTtlMs: Record<AuthTokenType, number> = {
  PASSWORD_SETUP: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
};

export async function issueAuthToken({
  userId,
  type,
  baseUrl,
  now = new Date(),
}: {
  userId: string;
  type: AuthTokenType;
  baseUrl: string;
  now?: Date;
}) {
  return prisma.$transaction((tx) => issueAuthTokenInTransaction(tx, { userId, type, baseUrl, now }));
}

export async function issueAuthTokenInTransaction(
  tx: Prisma.TransactionClient,
  {
    userId,
    type,
    baseUrl,
    now = new Date(),
  }: {
    userId: string;
    type: AuthTokenType;
    baseUrl: string;
    now?: Date;
  },
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      sessionVersion: true,
      isActive: true,
      role: true,
      customer: { select: { isActive: true } },
    },
  });
  if (!user || !user.isActive || (user.role === 'CUSTOMER' && !user.customer?.isActive)) {
    throw new InvalidAuthTokenError();
  }

  const rawToken = createRawAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(now.getTime() + tokenTtlMs[type]);
  await tx.authToken.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: now },
  });
  const tokenRecord = await tx.authToken.create({
    data: { userId, type, tokenHash, expiresAt, sessionVersion: user.sessionVersion },
  });

  const path = type === 'PASSWORD_SETUP' ? '/setup-password' : '/reset-password';
  const url = new URL(path, baseUrl);
  url.searchParams.set('token', rawToken);
  return { tokenId: tokenRecord.id, rawToken, url: url.toString(), expiresAt };
}

export async function consumePasswordToken({
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
    const record = await tx.authToken.findUnique({
      where: { tokenHash: hashAuthToken(token) },
      include: { user: { include: { customer: true } } },
    });
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

    const claimed = await tx.authToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new InvalidAuthTokenError();

    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        sessionVersion: { increment: 1 },
      },
    });
    await tx.authToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    });
    return { userId: record.userId, role: record.user.role, customerId: record.user.customerId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function assertPasswordTokenUsable({
  token,
  type,
  now = new Date(),
}: {
  token: string;
  type: AuthTokenType;
  now?: Date;
}) {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashAuthToken(token) },
    include: { user: { include: { customer: true } } },
  });
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

export class InvalidAuthTokenError extends Error {
  readonly code = 'INVALID_TOKEN';

  constructor() {
    super('הקישור אינו תקף או שפג תוקפו. בקשו קישור חדש.');
    this.name = 'InvalidAuthTokenError';
  }
}
