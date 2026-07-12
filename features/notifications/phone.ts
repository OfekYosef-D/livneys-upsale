const e164Pattern = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneToE164(value: string | null | undefined): string | null {
  if (!value) return null;

  const stripped = value.replace(/[^\d+]/g, '');
  if (!stripped) return null;

  if (stripped.startsWith('+')) {
    return e164Pattern.test(stripped) ? stripped : null;
  }

  if (stripped.startsWith('00')) {
    const candidate = `+${stripped.slice(2)}`;
    return e164Pattern.test(candidate) ? candidate : null;
  }

  if (stripped.startsWith('972')) {
    const candidate = `+${stripped}`;
    return e164Pattern.test(candidate) ? candidate : null;
  }

  if (stripped.startsWith('0') && stripped.length >= 9) {
    const candidate = `+972${stripped.slice(1)}`;
    return e164Pattern.test(candidate) ? candidate : null;
  }

  const candidate = `+${stripped}`;
  return e164Pattern.test(candidate) ? candidate : null;
}

export function toWhatsAppRecipient(value: string): string {
  return value.replace(/^\+/, '');
}
