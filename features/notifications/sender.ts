import {
  getWhatsAppConfig,
  hasWhatsAppProviderCredentials,
  type WhatsAppConfig,
  type WhatsAppTemplateKey,
} from './config';
import { toWhatsAppRecipient } from './phone';

type FetchLike = typeof fetch;

export type WhatsAppTemplateSendInput = {
  to: string;
  templateKey: WhatsAppTemplateKey;
  templateName: string | null;
  languageCode: string;
  bodyParameters: WhatsAppTemplateBodyParameter[];
};

export type WhatsAppTemplateBodyParameter =
  | string
  | {
      name: string;
      text: string;
    };

export type WhatsAppSendResult = {
  mode: 'dry-run' | 'live';
  providerMessageId: string | null;
};

export class PermanentWhatsAppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentWhatsAppError';
  }
}

export function buildWhatsAppTemplateRequest(input: {
  to: string;
  templateName: string;
  languageCode: string;
  bodyParameters: WhatsAppTemplateBodyParameter[];
}) {
  return {
    messaging_product: 'whatsapp',
    to: toWhatsAppRecipient(input.to),
    type: 'template',
    template: {
      name: input.templateName,
      language: {
        code: input.languageCode,
      },
      components: [
        {
          type: 'body',
          parameters: input.bodyParameters.map((parameter) => buildBodyParameter(parameter)),
        },
      ],
    },
  };
}

function buildBodyParameter(parameter: WhatsAppTemplateBodyParameter) {
  if (typeof parameter === 'string') {
    return {
      type: 'text',
      text: parameter,
    };
  }

  return {
    type: 'text',
    parameter_name: parameter.name,
    text: parameter.text,
  };
}

export async function sendWhatsAppTemplate(
  input: WhatsAppTemplateSendInput,
  {
    config = getWhatsAppConfig(),
    fetchImpl = fetch,
  }: {
    config?: WhatsAppConfig;
    fetchImpl?: FetchLike;
  } = {},
): Promise<WhatsAppSendResult> {
  if (!config.sendEnabled) {
    return {
      mode: 'dry-run',
      providerMessageId: null,
    };
  }

  if (!hasWhatsAppProviderCredentials(config)) {
    throw new PermanentWhatsAppError('WhatsApp sending is enabled but provider credentials are missing');
  }

  if (!input.templateName) {
    throw new PermanentWhatsAppError(`WhatsApp template is not configured for ${input.templateKey}`);
  }

  const response = await fetchImpl(`https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      buildWhatsAppTemplateRequest({
        to: input.to,
        templateName: input.templateName,
        languageCode: input.languageCode,
        bodyParameters: input.bodyParameters,
      }),
    ),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    const metaError = getMetaError(responseBody);
    const message = formatMetaErrorMessage(metaError, response.status);
    if (isPermanentMetaError(metaError, response.status)) {
      throw new PermanentWhatsAppError(message);
    }
    throw new Error(message);
  }

  const providerMessageId = getProviderMessageId(responseBody);
  if (!providerMessageId) {
    throw new Error('Meta WhatsApp API response did not include a message id');
  }

  return {
    mode: 'live',
    providerMessageId,
  };
}

function getProviderMessageId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('messages' in value) || !Array.isArray(value.messages)) {
    return null;
  }

  const firstMessage = value.messages[0] as { id?: unknown } | undefined;
  return typeof firstMessage?.id === 'string' ? firstMessage.id : null;
}

type MetaErrorBody = {
  message?: unknown;
  type?: unknown;
  code?: unknown;
  error_subcode?: unknown;
  error_data?: unknown;
  is_transient?: unknown;
  fbtrace_id?: unknown;
};

function getMetaError(value: unknown): MetaErrorBody | null {
  if (!value || typeof value !== 'object' || !('error' in value)) {
    return null;
  }

  return value.error as MetaErrorBody;
}

function formatMetaErrorMessage(error: MetaErrorBody | null, status: number): string {
  if (!error) {
    return `Meta WhatsApp API request failed with HTTP ${status}`;
  }

  const code = typeof error.code === 'number' || typeof error.code === 'string' ? String(error.code) : null;
  const subcode = typeof error.error_subcode === 'number' || typeof error.error_subcode === 'string' ? String(error.error_subcode) : null;
  const traceId = typeof error.fbtrace_id === 'string' ? error.fbtrace_id : null;
  const providerMessage = typeof error.message === 'string' ? error.message : `request failed with HTTP ${status}`;
  const details = getMetaErrorDetails(error.error_data);
  const diagnostics = [
    `HTTP ${status}`,
    code ? `code ${code}` : null,
    subcode ? `subcode ${subcode}` : null,
    traceId ? `trace ${traceId}` : null,
  ].filter(Boolean);

  return [
    `Meta WhatsApp API error${code ? ` ${code}` : ''} (${diagnostics.join(', ')}): ${providerMessage}`,
    details,
  ]
    .filter(Boolean)
    .join(' Details: ');
}

function getMetaErrorDetails(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const details = (value as { details?: unknown }).details;
  return typeof details === 'string' && details.trim().length > 0 ? details.trim() : null;
}

function isPermanentMetaError(error: MetaErrorBody | null, status: number): boolean {
  if (status >= 500) {
    return false;
  }

  if (error?.is_transient === true) {
    return false;
  }

  const code = typeof error?.code === 'number' ? error.code : Number(error?.code);
  if (code === 131000) {
    return false;
  }

  return status >= 400 && status < 500;
}
