import { Prisma } from '@prisma/client';
import { AppError, NotFoundError } from '@/lib/errors';
import type { TransactionClient } from '@/lib/transactions';

type AccessDb = Pick<TransactionClient, 'user' | 'authToken'>;

/**
 * Locks the customer row for the rest of the transaction. Every change that grants or revokes
 * access for a company takes this lock, so concurrent edits cannot re-enable a deactivated company.
 */
export async function lockCustomerAccessState(
  tx: Pick<TransactionClient, '$queryRaw'>,
  customerId: string,
): Promise<{ id: string; isActive: boolean } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>(Prisma.sql`
    SELECT "id", "isActive" FROM "Customer" WHERE "id" = ${customerId} FOR UPDATE
  `);
  return rows[0] ?? null;
}

/** Bumping sessionVersion signs the user out everywhere; consuming tokens kills open password links. */
async function revokeUserAccess(tx: AccessDb, where: Prisma.UserWhereInput, now: Date) {
  await tx.user.updateMany({ where, data: { sessionVersion: { increment: 1 } } });
  await tx.authToken.updateMany({ where: { usedAt: null, user: where }, data: { usedAt: now } });
}

export async function updateCustomerUserAccess(
  tx: AccessDb,
  input: { customerId: string; userId: string; isActive: boolean; now: Date },
) {
  const changed = await tx.user.updateMany({
    where: { id: input.userId, customerId: input.customerId, role: 'CUSTOMER' },
    data: { isActive: input.isActive, sessionVersion: { increment: 1 } },
  });
  if (changed.count !== 1) throw new NotFoundError('המשתמש לא נמצא בחברה זו.');

  if (!input.isActive) {
    await tx.authToken.updateMany({ where: { userId: input.userId, usedAt: null }, data: { usedAt: input.now } });
  }
}

/** Deactivating a company immediately signs out all of its users. */
export async function revokeCustomerSessionsOnDeactivation(
  tx: AccessDb,
  input: { customerId: string; wasActive: boolean; isActive: boolean; now: Date },
) {
  if (!input.wasActive || input.isActive) return;
  await revokeUserAccess(tx, { customerId: input.customerId }, input.now);
}

/**
 * The customer's main email is also the login of its primary user. When an admin changes it,
 * the login moves with it (and the old sessions/links are revoked).
 */
export async function syncCustomerLoginIdentity(
  tx: AccessDb,
  input: {
    currentEmail: string | null;
    nextEmail: string | null;
    nextContactName: string;
    users: Array<{ id: string; email: string }>;
    now: Date;
  },
) {
  if (input.currentEmail === input.nextEmail) return;

  const currentLogin = input.users.find((user) => user.email === input.currentEmail);
  if (!input.nextEmail) {
    if (currentLogin) throw new AppError('VALIDATION_ERROR', 'לא ניתן להסיר אימייל מלקוח עם חשבון התחברות.');
    return;
  }

  const existingLogin = input.users.find((user) => user.email === input.nextEmail);
  if (existingLogin) {
    await tx.user.update({ where: { id: existingLogin.id }, data: { name: input.nextContactName } });
    return;
  }

  if (currentLogin) {
    await tx.user.update({ where: { id: currentLogin.id }, data: { email: input.nextEmail, name: input.nextContactName } });
    await revokeUserAccess(tx, { id: currentLogin.id }, input.now);
  }
}
