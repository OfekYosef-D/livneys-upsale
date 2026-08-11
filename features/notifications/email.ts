type EnvLike = Record<string, string | undefined>;

export type EmailConfig = {
  apiKey: string | null;
  from: string | null;
};

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

type SendEmailOptions = {
  config?: EmailConfig;
  fetchImpl?: typeof fetch;
};

export function getEmailConfig(env: EnvLike = process.env): EmailConfig {
  return {
    apiKey: normalizeEnvText(env.RESEND_API_KEY),
    from: normalizeEnvText(env.EMAIL_FROM),
  };
}

export async function sendEmailMessage(
  message: EmailMessage,
  { config = getEmailConfig(), fetchImpl = fetch }: SendEmailOptions = {},
): Promise<{ mode: 'dry-run' | 'live'; providerMessageId: string | null }> {
  if (!config.apiKey || !config.from) {
    return { mode: 'dry-run', providerMessageId: null };
  }

  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { id?: unknown };
  return {
    mode: 'live',
    providerMessageId: typeof payload.id === 'string' ? payload.id : null,
  };
}

function normalizeEnvText(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
