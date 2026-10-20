'use server';

import bcrypt from 'bcryptjs';
import { AuthTokenType } from '@prisma/client';
import { after } from 'next/server';
import { prisma } from '@/lib/db';
import { AppError, AuthorizationError, NotFoundError, StaleVersionError } from '@/lib/errors';
import { adminAction, publicAction } from '@/lib/server-action';
import { decryptMfaSecret, encryptMfaSecret, generateMfaSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotpCode } from './mfa';
import { assertAccountAccessDeliveryConfigured, sendAccountAccessEmail } from './notifications';
import { consumeRateLimit } from './rate-limit';
import { getRequestBaseUrl, getRequestIp } from './request';
import {
  confirmMfaSchema,
  customerUserSchema,
  forgotPasswordSchema,
  inviteCustomerUserSchema,
  passwordTokenSchema,
  setCustomerUserActiveSchema,
  startMfaSchema,
} from './schema';
import { BCRYPT_ROUNDS, DUMMY_PASSWORD_HASH } from './security';
import { assertPasswordTokenUsable, consumePasswordToken, issueAuthToken, issueAuthTokenInTransaction } from './tokens';
import { lockCustomerAccessState, updateCustomerUserAccess } from './user-access';

const GENERIC_RESET_MESSAGE = 'אם קיים חשבון פעיל עבור הכתובת, נשלח אליו קישור מאובטח לאיפוס סיסמה.';

/** Always answers the same way (and takes the same time) so the form cannot be used to discover accounts. */
export const requestPasswordResetAction = publicAction(forgotPasswordSchema, async ({ email }) => {
  const [ip, baseUrl] = await Promise.all([getRequestIp(), getRequestBaseUrl()]);
  await consumeRateLimit('password-reset-ip', ip);
  await consumeRateLimit('password-reset-account', email);

  const user = await prisma.user.findUnique({ where: { email }, include: { customer: { select: { isActive: true } } } });
  const eligible = user?.isActive && (user.role === 'ADMIN' || user.customer?.isActive);
  let deliveryConfigured = true;
  try {
    assertAccountAccessDeliveryConfigured();
  } catch {
    deliveryConfigured = false;
  }

  if (eligible && deliveryConfigured) {
    const token = await issueAuthToken({ userId: user.id, type: AuthTokenType.PASSWORD_RESET, baseUrl });
    after(() => sendAccountAccessEmail({ userId: user.id, type: AuthTokenType.PASSWORD_RESET, url: token.url })
      .catch((error) => console.error('Failed to send password reset email', { userId: user.id, error })));
  }
  await bcrypt.compare('password-reset-timing-pad', DUMMY_PASSWORD_HASH);
  return { message: GENERIC_RESET_MESSAGE };
});

export const setPasswordWithTokenAction = publicAction(passwordTokenSchema, async ({ token, type, password }) => {
  const tokenType = type === 'setup' ? AuthTokenType.PASSWORD_SETUP : AuthTokenType.PASSWORD_RESET;
  await assertPasswordTokenUsable({ token, type: tokenType });
  const identity = await consumePasswordToken({ token, type: tokenType, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  return { redirectTo: identity.role === 'ADMIN' ? '/login?next=/admin' : '/login' };
});

export const inviteCustomerUserAction = adminAction(inviteCustomerUserSchema, async (input, ctx) => {
  assertAccountAccessDeliveryConfigured();
  const baseUrl = await getRequestBaseUrl();

  const { user, token } = await prisma.$transaction(async (tx) => {
    const customer = await lockCustomerAccessState(tx, input.customerId);
    if (!customer?.isActive) throw new AppError('INVALID_STATE', 'הלקוח אינו פעיל.');

    const created = await tx.user.create({
      data: { customerId: input.customerId, name: input.name, email: input.email, passwordHash: null, role: 'CUSTOMER', isActive: true },
    });
    const issued = await issueAuthTokenInTransaction(tx, { userId: created.id, type: AuthTokenType.PASSWORD_SETUP, baseUrl });
    await ctx.audit(tx, {
      customerId: input.customerId,
      entityType: 'User',
      entityId: created.id,
      action: 'CUSTOMER_USER_INVITED',
      after: { name: created.name, email: created.email, role: created.role },
    });
    return { user: created, token: issued };
  });

  await sendAccountAccessEmail({ userId: user.id, type: AuthTokenType.PASSWORD_SETUP, url: token.url });
  return { userId: user.id };
});

export const setCustomerUserActiveAction = adminAction(setCustomerUserActiveSchema, async (input, ctx) => {
  await prisma.$transaction(async (tx) => {
    const customer = await lockCustomerAccessState(tx, input.customerId);
    if (!customer) throw new NotFoundError('הלקוח לא נמצא.');
    if (input.isActive && !customer.isActive) throw new AppError('INVALID_STATE', 'לא ניתן להפעיל משתמש בחברה שאינה פעילה.');

    await updateCustomerUserAccess(tx, { ...input, now: new Date() });
    await ctx.audit(tx, {
      customerId: input.customerId,
      entityType: 'User',
      entityId: input.userId,
      action: input.isActive ? 'CUSTOMER_USER_ACTIVATED' : 'CUSTOMER_USER_DEACTIVATED',
      after: { isActive: input.isActive },
    });
  });
  return { userId: input.userId };
});

export const resendCustomerUserSetupAction = adminAction(customerUserSchema, async ({ customerId, userId }) => {
  assertAccountAccessDeliveryConfigured();
  const user = await prisma.user.findFirst({
    where: { id: userId, customerId, role: 'CUSTOMER', isActive: true, customer: { is: { isActive: true } } },
  });
  if (!user || user.passwordHash) throw new AppError('INVALID_STATE', 'ניתן לשלוח קישור רק למשתמש פעיל שטרם הגדיר סיסמה.');

  const token = await issueAuthToken({ userId: user.id, type: AuthTokenType.PASSWORD_SETUP, baseUrl: await getRequestBaseUrl() });
  await sendAccountAccessEmail({ userId: user.id, type: AuthTokenType.PASSWORD_SETUP, url: token.url });
  return { userId: user.id };
});

/** Starts (or replaces) authenticator-app MFA for the signed-in admin. Replacing requires the current password. */
export const startMfaEnrollmentAction = adminAction(startMfaSchema, async ({ password }, ctx) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.actorUserId },
    select: { email: true, mfaEnabled: true, passwordHash: true },
  });
  if (!user) throw new AuthorizationError();
  if (user.mfaEnabled) {
    await consumeMfaRateLimits(ctx.actorUserId);
    if (!password || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthorizationError('יש לאמת מחדש את הסיסמה הנוכחית לפני החלפת האימות הדו-שלבי.');
    }
  }

  const secret = generateMfaSecret();
  await prisma.user.update({ where: { id: ctx.actorUserId }, data: { mfaPendingSecretEncrypted: encryptMfaSecret(secret) } });
  const label = encodeURIComponent(`Livneys:${user.email}`);
  return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=Livneys&algorithm=SHA1&digits=6&period=30` };
});

export const confirmMfaEnrollmentAction = adminAction(confirmMfaSchema, async ({ code }, ctx) => {
  const user = await prisma.user.findUnique({ where: { id: ctx.actorUserId } });
  const pending = user?.mfaPendingSecretEncrypted;
  if (!pending) throw new StaleVersionError('יש להתחיל מחדש את הגדרת האימות הדו-שלבי.');
  await consumeMfaRateLimits(ctx.actorUserId);
  if (!verifyTotpCode(decryptMfaSecret(pending), code)) throw new AppError('VALIDATION_ERROR', 'קוד האימות אינו תקין.');

  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { id: ctx.actorUserId, mfaPendingSecretEncrypted: pending },
      data: { mfaEnabled: true, mfaSecretEncrypted: pending, mfaPendingSecretEncrypted: null, sessionVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new StaleVersionError('יש להתחיל מחדש את הגדרת האימות הדו-שלבי.');

    await tx.mfaRecoveryCode.deleteMany({ where: { userId: ctx.actorUserId } });
    await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((value) => ({ userId: ctx.actorUserId, codeHash: hashRecoveryCode(value) })) });
    await ctx.audit(tx, { entityType: 'User', entityId: ctx.actorUserId, action: 'ADMIN_MFA_ENABLED' });
  });
  return { recoveryCodes };
});

async function consumeMfaRateLimits(userId: string) {
  await consumeRateLimit('mfa-replacement-ip', await getRequestIp());
  await consumeRateLimit('mfa-replacement-account', userId);
}
