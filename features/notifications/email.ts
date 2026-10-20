import { PermanentDeliveryError, readEnvText, type DeliveryResult } from './delivery';

type EnvLike = Record<string, string | undefined>;

export type EmailConfig = {
  apiKey: string | null;
  from: string | null;
  replyTo: string | null;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export function getEmailConfig(env: EnvLike = process.env): EmailConfig {
  return {
    apiKey: readEnvText(env.RESEND_API_KEY),
    from: readEnvText(env.EMAIL_FROM),
    replyTo: readEnvText(env.EMAIL_REPLY_TO),
  };
}

export function isEmailConfigured(config: EmailConfig = getEmailConfig()): boolean {
  return Boolean(config.apiKey && config.from);
}

/** Sends through Resend. Without credentials it is a dry run, so local and preview environments never email customers. */
export async function sendEmailMessage(
  message: EmailMessage,
  { config = getEmailConfig(), fetchImpl = fetch }: { config?: EmailConfig; fetchImpl?: typeof fetch } = {},
): Promise<DeliveryResult> {
  if (!isEmailConfigured(config)) return { mode: 'dry-run', providerMessageId: null };

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      subject: message.subject,
      text: message.text,
      html: renderRtlHtml(message.text),
    }),
  });

  if (!response.ok) {
    const failure = `Email provider request failed with status ${response.status}`;
    // 4xx (other than rate limiting) will not succeed on retry: bad address, unverified domain, etc.
    if (response.status >= 400 && response.status < 500 && response.status !== 429) throw new PermanentDeliveryError(failure);
    throw new Error(failure);
  }

  const payload = (await response.json().catch(() => ({}))) as { id?: unknown };
  return { mode: 'live', providerMessageId: typeof payload.id === 'string' ? payload.id : null };
}

/** Hebrew needs an explicit RTL container; links are made clickable. */
export function renderRtlHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const linked = escaped.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" dir="ltr">${url}</a>`);
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;text-align:right">${linked.replace(/\n/g, '<br>')}</div>`;
}
