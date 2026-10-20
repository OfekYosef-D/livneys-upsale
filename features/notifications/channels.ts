import type { NotificationChannel, Prisma } from '@prisma/client';
import { getWhatsAppConfig, type NotificationTemplateKey, type WhatsAppConfig } from './config';
import type { DeliveryResult } from './delivery';
import { getEmailConfig, sendEmailMessage, type EmailConfig } from './email';
import { normalizePhoneToE164 } from './phone';
import { sendWhatsAppTemplate, type WhatsAppTemplateBodyParameter } from './sender';
import type { NotificationContent } from './templates';

export type NotificationRecipient = {
  isActive: boolean;
  email: string | null;
  phone: string;
  notificationPreference: { emailEnabled: boolean; whatsappEnabled: boolean } | null;
};

export type QueuedMessage = {
  templateName: string | null;
  payload: Prisma.InputJsonValue;
  /** True when nothing will really be sent (provider not configured). */
  dryRun: boolean;
};

/**
 * Strategy per delivery channel. The job pipeline (queue → claim → send → retry → audit trail)
 * is channel-agnostic; adding SMS later means adding one strategy here.
 */
export interface ChannelStrategy {
  readonly channel: NotificationChannel;
  /** Returns the address to send to, or null when this customer cannot or did not agree to be reached here. */
  resolveAddress(recipient: NotificationRecipient): string | null;
  /** Whether jobs should be created at all for this channel in the current environment. */
  isEnabled(): boolean;
  prepare(content: NotificationContent, address: string): QueuedMessage;
  send(job: { payload: Prisma.JsonValue; templateKey: string; templateName: string | null }): Promise<DeliveryResult>;
}

export type NotificationConfig = { email: EmailConfig; whatsapp: WhatsAppConfig };

export function loadNotificationConfig(): NotificationConfig {
  return { email: getEmailConfig(), whatsapp: getWhatsAppConfig() };
}

function createEmailChannel(config: EmailConfig): ChannelStrategy {
  return {
    channel: 'EMAIL',
    resolveAddress: (recipient) =>
      recipient.isActive && (recipient.notificationPreference?.emailEnabled ?? true) ? recipient.email : null,
    // Unconfigured email still creates dry-run jobs so the team can preview messages on test environments.
    isEnabled: () => true,
    prepare: (content, address) => ({
      templateName: null,
      dryRun: !(config.apiKey && config.from),
      payload: { to: address, subject: content.subject, text: content.text },
    }),
    send: ({ payload }) => sendEmailMessage(readEmailPayload(payload), { config }),
  };
}

function createWhatsAppChannel(config: WhatsAppConfig): ChannelStrategy {
  return {
    channel: 'WHATSAPP',
    resolveAddress: (recipient) =>
      recipient.isActive && recipient.notificationPreference?.whatsappEnabled ? normalizePhoneToE164(recipient.phone) : null,
    // While the business number is not connected, WhatsApp jobs are not created at all.
    isEnabled: () => config.sendEnabled,
    prepare: (content, address) => ({
      templateName: config.templates[content.templateKey as NotificationTemplateKey] ?? null,
      dryRun: !config.sendEnabled,
      payload: { to: address, languageCode: config.templateLanguage, bodyParameters: content.whatsappParameters },
    }),
    // Jobs queued before a template was configured pick up the current template name at send time.
    send: ({ payload, templateKey, templateName }) =>
      sendWhatsAppTemplate(
        { ...readWhatsAppPayload(payload), templateName: templateName ?? config.templates[templateKey as NotificationTemplateKey] ?? null },
        { config },
      ),
  };
}

export function getChannelStrategies(config: NotificationConfig = loadNotificationConfig()): ChannelStrategy[] {
  return [createEmailChannel(config.email), createWhatsAppChannel(config.whatsapp)];
}

export function getChannelStrategy(channel: NotificationChannel, config?: NotificationConfig): ChannelStrategy {
  return getChannelStrategies(config).find((strategy) => strategy.channel === channel)!;
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Notification job payload is invalid');
  return value as Record<string, unknown>;
}

function readEmailPayload(value: Prisma.JsonValue) {
  const payload = asRecord(value);
  if (typeof payload.to !== 'string' || typeof payload.subject !== 'string' || typeof payload.text !== 'string') {
    throw new Error('Notification job payload is missing email data');
  }
  return { to: payload.to, subject: payload.subject, text: payload.text };
}

function readWhatsAppPayload(value: Prisma.JsonValue) {
  const payload = asRecord(value);
  if (typeof payload.to !== 'string' || typeof payload.languageCode !== 'string' || !Array.isArray(payload.bodyParameters)) {
    throw new Error('Notification job payload is missing WhatsApp template data');
  }
  return {
    to: payload.to,
    languageCode: payload.languageCode,
    bodyParameters: payload.bodyParameters.map((parameter): WhatsAppTemplateBodyParameter => {
      if (typeof parameter === 'string') return parameter;
      const named = parameter as { name?: unknown; text?: unknown };
      return typeof named?.name === 'string' && typeof named.text === 'string'
        ? { name: named.name, text: named.text }
        : String(parameter);
    }),
  };
}
