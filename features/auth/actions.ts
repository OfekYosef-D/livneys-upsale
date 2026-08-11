'use server';

import bcrypt from 'bcryptjs';
import { AuthTokenType } from '@prisma/client';
import { actionError, actionOk, type ActionResult } from '@/lib/action-result';
import { assertAdminAction, assertAdminEnrollmentAction } from '@/lib/authorization';
import { prisma } from '@/lib/db';
import { confirmMfaSchema, forgotPasswordSchema, inviteCustomerUserSchema, passwordTokenSchema, setCustomerUserActiveSchema, startMfaSchema } from './schema';
import { getRequestBaseUrl, getRequestIp } from './request';
import { consumeRateLimit } from './rate-limit';
import { assertPasswordTokenUsable, consumePasswordToken, issueAuthToken, issueAuthTokenInTransaction } from './tokens';
import { assertAccountAccessDeliveryConfigured, sendAccountAccessNotifications } from './notifications';
import { encryptMfaSecret, generateMfaSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotpCode } from './mfa';
import { updateCustomerUserAccess } from './user-access';

const genericResetMessage = 'אם קיים חשבון פעיל עבור הכתובת, נשלח אליו קישור מאובטח לאיפוס סיסמה.';
const dummyPasswordHash = '$2b$12$lyBsPWU.S81FtafGOY3Or.lwCiOJSeIFoQAVRLMFCma6qvYPCK2Zy';

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  try {
    const parsed = forgotPasswordSchema.parse(input);
    const [ip, baseUrl] = await Promise.all([getRequestIp(), getRequestBaseUrl()]);
    await consumeRateLimit({
      scope: 'password-reset-ip',
      identifier: ip,
      limit: 20,
      windowMs: 30 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });
    await consumeRateLimit({
      scope: 'password-reset-account',
      identifier: parsed.email,
      limit: 4,
      windowMs: 30 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });

    const user = await prisma.user.findUnique({
      where: { email: parsed.email },
      include: { customer: { select: { isActive: true } } },
    });
    let deliveryConfigured = true;
    try { assertAccountAccessDeliveryConfigured(); } catch { deliveryConfigured = false; }
    if (deliveryConfigured && user?.isActive && (user.role === 'ADMIN' || user.customer?.isActive)) {
      const token = await issueAuthToken({ userId: user.id, type: AuthTokenType.PASSWORD_RESET, baseUrl });
      await notifySafely(user.id, AuthTokenType.PASSWORD_RESET, token.url);
    } else {
      await bcrypt.compare('invalid-reset-request', dummyPasswordHash);
    }
    return actionOk({ message: genericResetMessage });
  } catch (error) {
    return actionError(error);
  }
}

export async function setPasswordWithTokenAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const parsed = passwordTokenSchema.parse(input);
    const tokenType = typeof input === 'object' && input && 'type' in input && input.type === 'setup'
      ? AuthTokenType.PASSWORD_SETUP
      : AuthTokenType.PASSWORD_RESET;
    await assertPasswordTokenUsable({ token: parsed.token, type: tokenType });
    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const identity = await consumePasswordToken({
      token: parsed.token,
      type: tokenType,
      passwordHash,
    });
    return actionOk({ redirectTo: identity.role === 'ADMIN' ? '/login?next=/admin' : '/login' });
  } catch (error) {
    return actionError(error);
  }
}

export async function inviteCustomerUserAction(input: unknown): Promise<ActionResult<{ userId: string }>> {
  try {
    const parsed = inviteCustomerUserSchema.parse(input);
    await assertAdminAction();
    assertAccountAccessDeliveryConfigured();
    const customer = await prisma.customer.findUnique({ where: { id: parsed.customerId } });
    if (!customer?.isActive) throw new Error('הלקוח אינו פעיל.');

    const baseUrl = await getRequestBaseUrl();
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          customerId: parsed.customerId,
          name: parsed.name,
          email: parsed.email,
          passwordHash: null,
          role: 'CUSTOMER',
          isActive: true,
        },
      });
      const token = await issueAuthTokenInTransaction(tx, {
        userId: user.id,
        type: AuthTokenType.PASSWORD_SETUP,
        baseUrl,
      });
      return { user, token };
    });
    await sendAccountAccessNotifications({
      userId: created.user.id,
      type: AuthTokenType.PASSWORD_SETUP,
      url: created.token.url,
    });
    return actionOk({ userId: created.user.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function setCustomerUserActiveAction(input: unknown): Promise<ActionResult<{ userId: string }>> {
  try {
    const parsed = setCustomerUserActiveSchema.parse(input);
    await assertAdminAction();
    await prisma.$transaction((tx) => updateCustomerUserAccess(tx, { ...parsed, now: new Date() }));
    return actionOk({ userId: parsed.userId });
  } catch (error) {
    return actionError(error);
  }
}

export async function resendCustomerUserSetupAction(input: unknown): Promise<ActionResult<{ userId: string }>> {
  try {
    const parsed = setCustomerUserActiveSchema.pick({ customerId: true, userId: true }).parse(input);
    await assertAdminAction();
    assertAccountAccessDeliveryConfigured();
    const user = await prisma.user.findFirst({
      where: {
        id: parsed.userId,
        customerId: parsed.customerId,
        role: 'CUSTOMER',
        isActive: true,
        customer: { is: { isActive: true } },
      },
    });
    if (!user || user.passwordHash) throw new Error('ניתן לשלוח קישור רק למשתמש פעיל שטרם הגדיר סיסמה.');
    const token = await issueAuthToken({
      userId: user.id,
      type: AuthTokenType.PASSWORD_SETUP,
      baseUrl: await getRequestBaseUrl(),
    });
    await sendAccountAccessNotifications({
      userId: user.id,
      type: AuthTokenType.PASSWORD_SETUP,
      url: token.url,
    });
    return actionOk({ userId: user.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function startMfaEnrollmentAction(input: unknown): Promise<ActionResult<{ secret: string; uri: string }>> {
  try {
    startMfaSchema.parse(input);
    const session = await assertAdminEnrollmentAction();
    const secret = generateMfaSecret();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { mfaPendingSecretEncrypted: encryptMfaSecret(secret) },
    });
    const label = encodeURIComponent(`Livneys:${session.user.email ?? session.user.id}`);
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=Livneys&algorithm=SHA1&digits=6&period=30`;
    return actionOk({ secret, uri });
  } catch (error) {
    return actionError(error);
  }
}

export async function confirmMfaEnrollmentAction(input: unknown): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  try {
    const parsed = confirmMfaSchema.parse(input);
    const session = await assertAdminEnrollmentAction();
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.mfaPendingSecretEncrypted) throw new Error('יש להתחיל מחדש את הגדרת האימות הדו-שלבי.');

    const { decryptMfaSecret } = await import('./mfa');
    if (!verifyTotpCode(decryptMfaSecret(user.mfaPendingSecretEncrypted), parsed.code)) {
      throw new Error('קוד האימות אינו תקין.');
    }

    const recoveryCodes = generateRecoveryCodes();
    await prisma.$transaction(async (tx) => {
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({ userId: user.id, codeHash: hashRecoveryCode(code) })),
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaSecretEncrypted: user.mfaPendingSecretEncrypted,
          mfaPendingSecretEncrypted: null,
          sessionVersion: { increment: 1 },
        },
      });
    });
    return actionOk({ recoveryCodes });
  } catch (error) {
    return actionError(error);
  }
}

async function notifySafely(userId: string, type: AuthTokenType, url: string) {
  try {
    await sendAccountAccessNotifications({ userId, type, url });
  } catch (error) {
    console.error('Failed to send account access notification', { userId, type, error });
  }
}
