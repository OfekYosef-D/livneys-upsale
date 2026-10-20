/**
 * Click-to-chat links (wa.me) open WhatsApp on the team member's own phone with a prepared
 * message. They need no WhatsApp Business API, SIM or approval, so they work today.
 */
export function toWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string | null | undefined, text: string): string {
  const recipient = phone ? toWhatsAppPhone(phone) : null;
  return `https://wa.me/${recipient ?? ''}?text=${encodeURIComponent(text)}`;
}
