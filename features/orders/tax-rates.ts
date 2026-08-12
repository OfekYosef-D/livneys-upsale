import { prisma } from '../../lib/db';
import { SafeActionError } from '../../lib/safe-action-error';

export async function getEffectiveVatRate(at: Date): Promise<{ id: string; ratePercent: number }> {
  const rate = await prisma.taxRate.findFirst({
    where: {
      jurisdiction: 'IL',
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: 'desc' },
    select: { id: true, ratePercent: true },
  });

  if (!rate) {
    throw new SafeActionError(
      'TAX_RATE_NOT_CONFIGURED',
      'לא מוגדר שיעור מע״מ תקף למועד ההזמנה. לא ניתן להשלים את הפעולה.',
    );
  }

  return { id: rate.id, ratePercent: Number(rate.ratePercent) };
}
