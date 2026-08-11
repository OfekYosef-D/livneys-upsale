import type { AuthTokenType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEmailConfig, sendEmailMessage } from '@/features/notifications/email';
import { getWhatsAppConfig, resolveWhatsAppTemplateName } from '@/features/notifications/config';
import { normalizePhoneToE164 } from '@/features/notifications/phone';
import { sendWhatsAppTemplate } from '@/features/notifications/sender';

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
  if (!user) return { email: 'skipped', whatsapp: 'skipped' } as const;

  const isSetup = type === 'PASSWORD_SETUP';
  const subject = isSetup ? "הגדרת סיסמה לחשבון Livney's" : "איפוס סיסמה לחשבון Livney's";
  const text = `${user.name},\n\n${isSetup ? 'החשבון שלך אושר. להגדרת סיסמה' : 'לאיפוס הסיסמה'} יש לפתוח את הקישור הבא:\n${url}\n\n${isSetup ? 'הקישור תקף ל-24 שעות' : 'הקישור תקף ל-30 דקות'} וניתן לשימוש פעם אחת בלבד.`;
  const emailResult = await sendEmailMessage(
    { to: user.email, subject, text },
    { config: getEmailConfig() },
  );

  const customer = user.customer;
  const phone = customer ? normalizePhoneToE164(customer.phone) : null;
  if (!customer?.isActive || !customer.notificationPreference?.whatsappEnabled || !phone) {
    return { email: emailResult.mode, whatsapp: 'skipped' } as const;
  }

  const config = getWhatsAppConfig();
  const templateKey = type;
  const whatsappResult = await sendWhatsAppTemplate({
    to: phone,
    templateKey,
    templateName: resolveWhatsAppTemplateName(templateKey, config),
    languageCode: config.templateLanguage,
    bodyParameters: [user.name, url],
  }, { config });
  return { email: emailResult.mode, whatsapp: whatsappResult.mode } as const;
}
