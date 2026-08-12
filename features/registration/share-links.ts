export function getPublicAppOrigin(fallback?: string | null): string {
  const fromFallback = fallback?.trim().replace(/\/$/, '') ?? '';
  if (fromFallback) return fromFallback;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'https://livneys-upsale.vercel.app';
}

export function getRegistrationUrl(origin?: string | null): string {
  return `${getPublicAppOrigin(origin)}/register`;
}

export function getLoginUrl(origin?: string | null): string {
  return `${getPublicAppOrigin(origin)}/login`;
}

export function toWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string | null | undefined, text: string): string {
  const normalized = phone ? toWhatsAppPhone(phone) : null;
  const encoded = encodeURIComponent(text);
  return normalized ? `https://wa.me/${normalized}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function buildRegistrationInviteMessage(origin?: string | null): string {
  return [
    "שלום מליבני'ס,",
    'להרשמת עסק חדש בפלטפורמת ההזמנות המוסדיות:',
    getRegistrationUrl(origin),
  ].join('\n');
}

export function buildLoginInviteMessage(origin?: string | null): string {
  return [
    "שלום מליבני'ס,",
    'קישור הכניסה לפלטפורמת ההזמנות:',
    getLoginUrl(origin),
  ].join('\n');
}
