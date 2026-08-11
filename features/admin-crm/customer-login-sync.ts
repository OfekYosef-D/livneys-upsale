import type { Prisma } from '@prisma/client';

type CustomerLoginUser = { id: string; email: string };

export async function syncCustomerLoginIdentity(
  tx: Pick<Prisma.TransactionClient, 'user' | 'authToken'>,
  input: {
    currentEmail: string | null;
    nextEmail: string | null;
    nextContactName: string;
    users: CustomerLoginUser[];
    now: Date;
  },
) {
  if (input.currentEmail === input.nextEmail) return;

  const currentLoginUser = input.users.find((user) => user.email === input.currentEmail);
  if (!input.nextEmail) {
    if (currentLoginUser) {
      throw new Error('לא ניתן להסיר אימייל מלקוח עם חשבון התחברות.');
    }
    return;
  }

  const destinationLoginUser = input.users.find((user) => user.email === input.nextEmail);
  if (destinationLoginUser) {
    await tx.user.update({
      where: { id: destinationLoginUser.id },
      data: { name: input.nextContactName },
    });
    return;
  }

  if (currentLoginUser) {
    await tx.user.update({
      where: { id: currentLoginUser.id },
      data: {
        email: input.nextEmail,
        name: input.nextContactName,
        sessionVersion: { increment: 1 },
      },
    });
    await tx.authToken.updateMany({
      where: { userId: currentLoginUser.id, usedAt: null },
      data: { usedAt: input.now },
    });
  }
}
