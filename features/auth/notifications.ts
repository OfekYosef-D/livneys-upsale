import type { AuthTokenType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEmailConfig, sendEmailMessage } from '@/features/notifications/email';
import { getWhatsAppConfig, resolveWhatsAppTemplateName } from '@/features/notifications/config';
import { normalizePhoneToE164 } from '@/features/notifications/phone';
import { sendWhatsAppTemplate } from '@/features/notifications/sender';

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
    include: { customer: { include: { notificationPreference: true } } },
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

  const customer = user.customer;
  const phone = customer ? normalizePhoneToE164(customer.phone) : null;
  if (!customer?.isActive || !customer.notificationPreference?.whatsappEnabled || !phone) {
    if (emailResult.mode !== 'live') throw new AccountAccessDeliveryError();
    return { delivered: true, email: emailResult.mode, whatsapp: 'skipped' } as const;
  }

  const config = getWhatsAppConfig();
  const templateKey = type;
  let whatsappResult: Awaited<ReturnType<typeof sendWhatsAppTemplate>>;
  try {
    whatsappResult = await sendWhatsAppTemplate({
      to: phone,
      templateKey,
      templateName: resolveWhatsAppTemplateName(templateKey, config),
      languageCode: config.templateLanguage,
      bodyParameters: [user.name, url],
    }, { config });
  } catch (error) {
    console.error('Account access WhatsApp delivery failed', { userId, type, error });
    if (emailResult.mode === 'live') {
      return { delivered: true, email: emailResult.mode, whatsapp: 'failed' } as const;
    }
    throw new AccountAccessDeliveryError();
  }
  const delivered = emailResult.mode === 'live' || whatsappResult.mode === 'live';
  if (!delivered) throw new AccountAccessDeliveryError();
  return { delivered, email: emailResult.mode, whatsapp: whatsappResult.mode } as const;
}
