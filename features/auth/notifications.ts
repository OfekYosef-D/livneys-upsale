import type { AuthTokenType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEmailConfig, sendEmailMessage } from '@/features/notifications/email';

export class AccountAccessDeliveryError extends Error {
  constructor(message = 'החשבון נשמר, אך לא ניתן היה למסור את קישור הגישה. יש לנסות שליחה מחדש מכרטיס הלקוח.') {
    super(message);
    this.name = 'AccountAccessDeliveryError';
  }
}

export function assertAccountAccessDeliveryConfigured() {
  const email = getEmailConfig();
  if (!email.apiKey || !email.from) {
    throw new AccountAccessDeliveryError('לא מוגדר ערוץ מסירה פעיל לקישורי גישה. יש להגדיר Resend לפני פתיחת החשבון.');
  }
}

export async function sendAccountAccessNotifications({
  userId,
  type,
  url,
}: {
  userId: string;
  type: AuthTokenType;
  url: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) throw new AccountAccessDeliveryError();

  const isSetup = type === 'PASSWORD_SETUP';
  const subject = isSetup ? "הגדרת סיסמה לחשבון Livney's" : "איפוס סיסמה לחשבון Livney's";
  const text = `${user.name},\n\n${isSetup ? 'החשבון שלך אושר. להגדרת סיסמה' : 'לאיפוס הסיסמה'} יש לפתוח את הקישור הבא:\n${url}\n\n${isSetup ? 'הקישור תקף ל-24 שעות' : 'הקישור תקף ל-30 דקות'} וניתן לשימוש פעם אחת בלבד.`;
  let emailResult: Awaited<ReturnType<typeof sendEmailMessage>>;
  try {
    emailResult = await sendEmailMessage(
      { to: user.email, subject, text },
      { config: getEmailConfig() },
    );
  } catch (error) {
    console.error('Account access email delivery failed', { userId, type, error });
    throw new AccountAccessDeliveryError();
  }

  if (emailResult.mode !== 'live') throw new AccountAccessDeliveryError();
  return { delivered: true, email: emailResult.mode, whatsapp: 'skipped' } as const;
}
