import { Prisma } from '@prisma/client';

type AuditWriter = Pick<Prisma.TransactionClient, 'auditLog'>;

export type AuditEntry = {
  customerId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
};

/** Writes an audit entry on behalf of the current actor; provided by the server-action context. */
export type RecordAudit = (tx: AuditWriter, entry: AuditEntry) => Promise<unknown>;

export type AuditLogInput = AuditEntry & {
  actorUserId?: string | null;
  actorRole?: string | null;
  requestId: string;
};

const SECRET_KEY_PATTERN = /password|secret|token|recovery|authorization|cookie/i;

/** Audit rows are append-only (enforced by a database trigger) and must be written inside the business transaction. */
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

/** Converts Decimals/Dates to JSON and redacts anything that looks like a credential. */
export function sanitizeAuditValue(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  return sanitizeNested(value);
}

/** Nested nulls are meaningful in before/after snapshots (e.g. a cleared field), so they are kept. */
function sanitizeNested(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Prisma.Decimal.isDecimal(value)) return value.toJSON();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeNested);
  if (typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeNested(nested),
  ]));
}
