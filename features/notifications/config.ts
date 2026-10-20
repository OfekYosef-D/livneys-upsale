import { readEnvText } from './delivery';

/** Customer-facing message types. Each one needs a matching approved template in Meta before WhatsApp can go live. */
export const notificationTemplateKeys = [
  'ORDER_REMINDER',
  'ORDER_RECEIVED',
  'ORDER_SPECIAL_REQUEST',
  'ORDER_APPROVED',
  'ORDER_PACKED',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'ORDER_ADDITION_APPROVED',
  'ORDER_ADDITION_REJECTED',
] as const;

export type NotificationTemplateKey = (typeof notificationTemplateKeys)[number];

type EnvLike = Record<string, string | undefined>;

export type WhatsAppConfig = {
  sendEnabled: boolean;
  accessToken: string | null;
  phoneNumberId: string | null;
  graphApiVersion: string;
  templateLanguage: string;
  webhookVerifyToken: string | null;
  appSecret: string | null;
  templates: Record<NotificationTemplateKey, string | null>;
};

export function getWhatsAppConfig(env: EnvLike = process.env): WhatsAppConfig {
  return {
    sendEnabled: env.WHATSAPP_SEND_ENABLED === 'true' || env.WHATSAPP_SEND_ENABLED === '1',
    accessToken: readEnvText(env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: readEnvText(env.WHATSAPP_PHONE_NUMBER_ID),
    graphApiVersion: readEnvText(env.WHATSAPP_GRAPH_API_VERSION) ?? 'v25.0',
    templateLanguage: readEnvText(env.WHATSAPP_TEMPLATE_LANGUAGE) ?? 'he',
    webhookVerifyToken: readEnvText(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    appSecret: readEnvText(env.WHATSAPP_APP_SECRET),
    templates: Object.fromEntries(
      notificationTemplateKeys.map((key) => [key, readEnvText(env[`WHATSAPP_TEMPLATE_${key}`])]),
    ) as Record<NotificationTemplateKey, string | null>,
  };
}

export function hasWhatsAppProviderCredentials(config: WhatsAppConfig): boolean {
  return Boolean(config.accessToken && config.phoneNumberId);
}

/** Public base URL used in links inside messages. */
export function getAppBaseUrl(env: EnvLike = process.env): string {
  return (readEnvText(env.NEXTAUTH_URL) ?? 'http://localhost:3000').replace(/\/+$/, '');
}
