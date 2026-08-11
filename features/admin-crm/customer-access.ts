import type { Prisma } from '@prisma/client';

export async function revokeCustomerSessionsOnDeactivation(
  tx: Pick<Prisma.TransactionClient, 'user' | 'authToken'>,
  input: { customerId: string; wasActive: boolean; isActive: boolean; now: Date },
) {
  if (!input.wasActive || input.isActive) return;

  await tx.user.updateMany({
    where: { customerId: input.customerId },
    data: { sessionVersion: { increment: 1 } },
  });
  await tx.authToken.updateMany({
    where: { usedAt: null, user: { customerId: input.customerId } },
    data: { usedAt: input.now },
  });
}
