import { Prisma } from '@prisma/client';

export async function lockCustomerAccessState(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  customerId: string,
): Promise<{ id: string; isActive: boolean } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>(Prisma.sql`
    SELECT "id", "isActive"
    FROM "Customer"
    WHERE "id" = ${customerId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}
