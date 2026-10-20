import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { getPrismaErrorCode, StaleVersionError } from './errors';

export type TransactionClient = Prisma.TransactionClient;

const MAX_ATTEMPTS = 3;

/** Serialization failures and unique-key races are safe to retry from the top. */
export function isRetryableWriteError(error: unknown): boolean {
  if (error instanceof StaleVersionError) return true;
  const code = getPrismaErrorCode(error);
  return code === 'P2002' || code === 'P2034';
}

/**
 * Runs `work` in a SERIALIZABLE transaction and retries on write conflicts.
 * `onConflict` may resolve a conflict instead of retrying (e.g. an idempotent replay
 * that another request already committed); returning undefined keeps retrying.
 */
export async function runSerializable<T>(
  work: (tx: TransactionClient) => Promise<T>,
  { onConflict }: { onConflict?: (error: unknown) => Promise<T | undefined> } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isRetryableWriteError(error)) throw error;
      const resolved = await onConflict?.(error);
      if (resolved !== undefined) return resolved;
      if (attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}
