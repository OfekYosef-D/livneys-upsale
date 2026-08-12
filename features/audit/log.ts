import type { Prisma } from '@prisma/client';

type AuditWriter = Pick<Prisma.TransactionClient, 'auditLog'>;

export type AuditLogInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  customerId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  requestId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

export async function appendAuditLog(tx: AuditWriter, input: AuditLogInput) {
  const before = sanitizeAuditValue(input.before);
  const after = sanitizeAuditValue(input.after);
  const metadata = sanitizeAuditValue(input.metadata);

  return tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      customerId: input.customerId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      requestId: input.requestId,
      ...(before === undefined ? {} : { before: before as Prisma.InputJsonValue }),
      ...(after === undefined ? {} : { after: after as Prisma.InputJsonValue }),
      ...(metadata === undefined ? {} : { metadata: metadata as Prisma.InputJsonValue }),
    },
  });
}

export function sanitizeAuditValue(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    /password|secret|token|recovery|authorization|cookie/i.test(key)
      ? '[REDACTED]'
      : sanitizeAuditValue(nested),
  ]));
}
