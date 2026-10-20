import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { credentialsSchema } from './schema';
import { clearRateLimit, consumeRateLimit } from './rate-limit';
import { decryptMfaSecret, hashRecoveryCode, verifyTotpCode } from './mfa';
import { DUMMY_PASSWORD_HASH } from './security';

export type AuthenticatedIdentity = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CUSTOMER';
  customerId: string | null;
  sessionVersion: number;
  mfaEnabled: boolean;
};

export async function authenticateCredentials(
  rawCredentials: unknown,
  { ip = 'unknown', now = new Date() }: { ip?: string; now?: Date } = {},
): Promise<AuthenticatedIdentity | null> {
  const parsed = credentialsSchema.safeParse(rawCredentials);
  if (!parsed.success) return null;

  const email = parsed.data.email.toLowerCase();
  await consumeRateLimit('login-ip', ip, now);
  await consumeRateLimit('login-account', email, now);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { customer: true },
  });
  const passwordMatches = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  const eligible = Boolean(
    user
    && user.isActive
    && user.passwordHash
    && passwordMatches
    && (user.role !== 'CUSTOMER' || (user.customerId && user.customer?.isActive)),
  );
  if (!eligible || !user) return null;

  if (user.role === 'ADMIN' && user.mfaEnabled) {
    const secondFactorValid = await verifyAdminSecondFactor({
      userId: user.id,
      encryptedSecret: user.mfaSecretEncrypted,
      code: parsed.data.mfaCode,
      now,
    });
    if (!secondFactorValid) return null;
  }

  await clearRateLimit('login-account', email);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    customerId: user.customerId,
    sessionVersion: user.sessionVersion,
    mfaEnabled: user.mfaEnabled,
  };
}

async function verifyAdminSecondFactor({
  userId,
  encryptedSecret,
  code,
  now,
}: {
  userId: string;
  encryptedSecret: string | null;
  code: string;
  now: Date;
}): Promise<boolean> {
  if (!code) return false;
  if (encryptedSecret) {
    try {
      if (verifyTotpCode(decryptMfaSecret(encryptedSecret), code, now)) return true;
    } catch {
      // A recovery code remains usable if the encrypted TOTP secret is damaged or a key was rotated.
    }
  }

  const claimed = await prisma.mfaRecoveryCode.updateMany({
    where: {
      userId,
      codeHash: hashRecoveryCode(code),
      usedAt: null,
    },
    data: { usedAt: now },
  });
  return claimed.count === 1;
}
