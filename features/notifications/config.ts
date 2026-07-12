export const whatsappTemplateKeys = [
  'ORDER_REMINDER',
  'ORDER_RECEIVED',
  'ORDER_APPROVED',
  'ORDER_PACKED',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'ORDER_SPECIAL_REQUEST',
] as const;

export type WhatsAppTemplateKey = (typeof whatsappTemplateKeys)[number];

type EnvLike = Record<string, string | undefined>;

export type WhatsAppConfig = {
  sendEnabled: boolean;
  accessToken: string | null;
  phoneNumberId: string | null;
  graphApiVersion: string;
  templateLanguage: string;
  webhookVerifyToken: string | null;
  appSecret: string | null;
  cronSecret: string | null;
  baseUrl: string | null;
  templates: Record<WhatsAppTemplateKey, string | null>;
};

const templateEnvNames: Record<WhatsAppTemplateKey, string> = {
  ORDER_REMINDER: 'WHATSAPP_TEMPLATE_ORDER_REMINDER',
  ORDER_RECEIVED: 'WHATSAPP_TEMPLATE_ORDER_RECEIVED',
  ORDER_APPROVED: 'WHATSAPP_TEMPLATE_ORDER_APPROVED',
  ORDER_PACKED: 'WHATSAPP_TEMPLATE_ORDER_PACKED',
  ORDER_DELIVERED: 'WHATSAPP_TEMPLATE_ORDER_DELIVERED',
  ORDER_CANCELLED: 'WHATSAPP_TEMPLATE_ORDER_CANCELLED',
  ORDER_SPECIAL_REQUEST: 'WHATSAPP_TEMPLATE_ORDER_SPECIAL_REQUEST',
};

export function getWhatsAppConfig(env: EnvLike = process.env): WhatsAppConfig {
  return {
    sendEnabled: parseBoolean(env.WHATSAPP_SEND_ENABLED),
    accessToken: normalizeEnvText(env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: normalizeEnvText(env.WHATSAPP_PHONE_NUMBER_ID),
    graphApiVersion: normalizeEnvText(env.WHATSAPP_GRAPH_API_VERSION) ?? 'v25.0',
    templateLanguage: normalizeEnvText(env.WHATSAPP_TEMPLATE_LANGUAGE) ?? 'he',
    webhookVerifyToken: normalizeEnvText(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    appSecret: normalizeEnvText(env.WHATSAPP_APP_SECRET),
    cronSecret: normalizeEnvText(env.CRON_SECRET),
    baseUrl: normalizeEnvText(env.NEXTAUTH_URL),
    templates: whatsappTemplateKeys.reduce(
      (accumulator, key) => ({
        ...accumulator,
        [key]: normalizeEnvText(env[templateEnvNames[key]]),
      }),
      {} as Record<WhatsAppTemplateKey, string | null>,
    ),
  };
}

export function resolveWhatsAppTemplateName(key: WhatsAppTemplateKey, config = getWhatsAppConfig()): string | null {
  return config.templates[key] ?? null;
}

export function hasWhatsAppProviderCredentials(config = getWhatsAppConfig()): boolean {
  return Boolean(config.accessToken && config.phoneNumberId);
}

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function normalizeEnvText(value: string | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
