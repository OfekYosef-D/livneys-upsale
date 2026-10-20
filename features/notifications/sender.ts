import { hasWhatsAppProviderCredentials, type WhatsAppConfig } from './config';
import { PermanentDeliveryError, type DeliveryResult } from './delivery';
import { toWhatsAppRecipient } from './phone';

export type WhatsAppTemplateBodyParameter = string | { name: string; text: string };

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string | null;
  languageCode: string;
  bodyParameters: WhatsAppTemplateBodyParameter[];
};

export function buildWhatsAppTemplateRequest(input: WhatsAppTemplateMessage & { templateName: string }) {
  return {
    messaging_product: 'whatsapp',
    to: toWhatsAppRecipient(input.to),
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
      components: [
        {
          type: 'body',
          parameters: input.bodyParameters.map((parameter) =>
            typeof parameter === 'string'
              ? { type: 'text', text: parameter }
              : { type: 'text', parameter_name: parameter.name, text: parameter.text }),
        },
      ],
    },
  };
}

/** Sends an approved template through the WhatsApp Cloud API. Disabled sending is a dry run. */
export async function sendWhatsAppTemplate(
  message: WhatsAppTemplateMessage,
  { config, fetchImpl = fetch }: { config: WhatsAppConfig; fetchImpl?: typeof fetch },
): Promise<DeliveryResult> {
  if (!config.sendEnabled) return { mode: 'dry-run', providerMessageId: null };
  if (!hasWhatsAppProviderCredentials(config)) {
    throw new PermanentDeliveryError('WhatsApp sending is enabled but provider credentials are missing');
  }
  if (!message.templateName) throw new PermanentDeliveryError('WhatsApp template is not configured for this message type');

  const response = await fetchImpl(`https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildWhatsAppTemplateRequest({ ...message, templateName: message.templateName })),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const error = getMetaError(body);
    const description = describeMetaError(error, response.status);
    throw isPermanentMetaError(error, response.status) ? new PermanentDeliveryError(description) : new Error(description);
  }

  const providerMessageId = getProviderMessageId(body);
  if (!providerMessageId) throw new Error('Meta WhatsApp API response did not include a message id');
  return { mode: 'live', providerMessageId };
}

type MetaError = {
  message?: unknown;
  code?: unknown;
  error_subcode?: unknown;
  error_data?: { details?: unknown };
  is_transient?: unknown;
  fbtrace_id?: unknown;
};

function getProviderMessageId(body: unknown): string | null {
  const messages = (body as { messages?: Array<{ id?: unknown }> } | null)?.messages;
  const id = Array.isArray(messages) ? messages[0]?.id : null;
  return typeof id === 'string' ? id : null;
}

function getMetaError(body: unknown): MetaError | null {
  return body && typeof body === 'object' && 'error' in body ? (body.error as MetaError) : null;
}

function describeMetaError(error: MetaError | null, status: number): string {
  if (!error) return `Meta WhatsApp API request failed with HTTP ${status}`;
  const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : null);
  const diagnostics = [
    `HTTP ${status}`,
    text(error.code) && `code ${text(error.code)}`,
    text(error.error_subcode) && `subcode ${text(error.error_subcode)}`,
    text(error.fbtrace_id) && `trace ${text(error.fbtrace_id)}`,
  ].filter(Boolean);
  const details = typeof error.error_data?.details === 'string' ? ` Details: ${error.error_data.details.trim()}` : '';
  return `Meta WhatsApp API error (${diagnostics.join(', ')}): ${text(error.message) ?? 'request failed'}${details}`;
}

/** 5xx, explicitly transient errors and code 131000 ("something went wrong") are retried. */
function isPermanentMetaError(error: MetaError | null, status: number): boolean {
  if (status >= 500 || error?.is_transient === true) return false;
  if (Number(error?.code) === 131000) return false;
  return status >= 400 && status < 500;
}
