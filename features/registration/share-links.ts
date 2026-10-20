const trimSlash = (origin: string) => origin.replace(/\/+$/, '');

export function getRegistrationUrl(origin: string): string {
  return `${trimSlash(origin)}/register`;
}

export function getLoginUrl(origin: string): string {
  return `${trimSlash(origin)}/login`;
}

export function buildRegistrationInviteMessage(origin: string): string {
  return ["שלום מליבני'ס,", 'להרשמה לפלטפורמת ההזמנות לעסקים:', getRegistrationUrl(origin)].join('\n');
}

export function buildLoginInviteMessage(origin: string): string {
  return ["שלום מליבני'ס,", 'קישור הכניסה לפלטפורמת ההזמנות:', getLoginUrl(origin)].join('\n');
}
