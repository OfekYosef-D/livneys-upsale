import type { Prisma } from '@prisma/client';

export async function revokeCustomerSessionsOnDeactivation(
  tx: Pick<Prisma.TransactionClient, 'user'>,
  input: { customerId: string; wasActive: boolean; isActive: boolean },
) {
  if (!input.wasActive || input.isActive) return;

  await tx.user.updateMany({
    where: { customerId: input.customerId },
    data: { sessionVersion: { increment: 1 } },
  });
}
