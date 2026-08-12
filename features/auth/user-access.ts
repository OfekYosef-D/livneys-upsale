import type { Prisma } from '@prisma/client';
import { SafeActionError } from '../../lib/safe-action-error';

export async function updateCustomerUserAccess(
  tx: Pick<Prisma.TransactionClient, 'user' | 'authToken'>,
  input: { customerId: string; userId: string; isActive: boolean; now: Date },
) {
  const changed = await tx.user.updateMany({
    where: { id: input.userId, customerId: input.customerId, role: 'CUSTOMER' },
    data: { isActive: input.isActive, sessionVersion: { increment: 1 } },
  });
  if (changed.count !== 1) throw new SafeActionError('NOT_FOUND', 'המשתמש לא נמצא בחברה זו.');

  if (!input.isActive) {
    await tx.authToken.updateMany({
      where: { userId: input.userId, usedAt: null },
      data: { usedAt: input.now },
    });
  }
}
