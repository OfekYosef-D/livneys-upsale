import type { AuthTokenType } from '@prisma/client';

/** How long each kind of one-time link stays valid (mirrors `tokenTtlMs` in tokens.ts). */
export const accessLinkValidity: Record<AuthTokenType, string> = {
  PASSWORD_SETUP: '24 שעות',
  PASSWORD_RESET: '30 דקות',
};

/** WhatsApp/SMS text the team sends with a one-time account link. */
export function buildAccessLinkMessage({ contact, url, type }: { contact: string; url: string; type: AuthTokenType }): string {
  return [
    `שלום ${contact},`,
    type === 'PASSWORD_SETUP'
      ? "החשבון שלכם במערכת ההזמנות של ליבני'ס מוכן. לבחירת סיסמה וכניסה ראשונה:"
      : "לבחירת סיסמה חדשה למערכת ההזמנות של ליבני'ס:",
    url,
    `הקישור אישי, תקף ל-${accessLinkValidity[type]} וניתן לשימוש פעם אחת.`,
  ].join('\n');
}
