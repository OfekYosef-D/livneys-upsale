import type { AuthTokenType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { getEmailConfig, isEmailConfigured, sendEmailMessage } from '../notifications/email';

/** Account links are security-sensitive, so they are never queued as dry runs. */
export class AccountAccessDeliveryError extends AppError {
  constructor(message = 'החשבון נשמר, אך לא ניתן היה לשלוח את קישור הגישה. נסו "שליחת קישור מחדש" מכרטיס הלקוח.') {
    super('DELIVERY_UNAVAILABLE', message);
  }
}

export function assertAccountAccessDeliveryConfigured(): void {
  if (!isEmailConfigured()) {
    throw new AccountAccessDeliveryError('שליחת אימיילים אינה מוגדרת (Resend). יש להגדיר אותה לפני פתיחת חשבונות ללקוחות.');
  }
}

export async function sendAccountAccessEmail({ userId, type, url }: { userId: string; type: AuthTokenType; url: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user) throw new AccountAccessDeliveryError();

  const isSetup = type === 'PASSWORD_SETUP';
  const subject = isSetup ? "הגדרת סיסמה לחשבון ליבני'ס" : "איפוס סיסמה לחשבון ליבני'ס";
  const text = [
    `שלום ${user.name},`,
    '',
    isSetup
      ? "החשבון שלכם בפלטפורמת ההזמנות של ליבני'ס מוכן. לבחירת סיסמה וכניסה ראשונה:"
      : 'לבחירת סיסמה חדשה:',
    url,
    '',
    isSetup ? 'הקישור תקף ל-24 שעות וניתן לשימוש פעם אחת.' : 'הקישור תקף ל-30 דקות וניתן לשימוש פעם אחת.',
    'אם לא ביקשתם זאת, אפשר להתעלם מהמייל.',
  ].join('\n');

  try {
    const result = await sendEmailMessage({ to: user.email, subject, text }, { config: getEmailConfig() });
    if (result.mode !== 'live') throw new AccountAccessDeliveryError();
  } catch (error) {
    if (error instanceof AccountAccessDeliveryError) throw error;
    console.error('Account access email delivery failed', { userId, type, error });
    throw new AccountAccessDeliveryError();
  }
}

export type AccountAccessLink = { url: string; type: AuthTokenType; emailed: boolean };

/**
 * Admin-issued account links. The link always comes back to the admin, who sends it to the customer
 * (WhatsApp from their own phone); it is also emailed when email delivery is configured.
 */
export async function deliverAccountAccessLink(input: { userId: string; type: AuthTokenType; url: string }): Promise<AccountAccessLink> {
  const link = { url: input.url, type: input.type };
  if (!isEmailConfigured()) return { ...link, emailed: false };
  try {
    await sendAccountAccessEmail(input);
    return { ...link, emailed: true };
  } catch (error) {
    if (error instanceof AccountAccessDeliveryError) return { ...link, emailed: false };
    throw error;
  }
}
