import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

type CountableModel = 'product' | 'customer' | 'route' | 'priceList';

const missingMessages: Record<CountableModel, string> = {
  product: 'חלק מהמוצרים לא נמצאו.',
  customer: 'חלק מהלקוחות לא נמצאו.',
  route: 'חלק מהקווים לא נמצאו.',
  priceList: 'חלק מהמחירונים לא נמצאו.',
};

/** Verifies that every referenced id exists before writing relations to it. */
export async function assertAllExist(model: CountableModel, ids: readonly string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;

  const where = { id: { in: unique } };
  const counts: Record<CountableModel, () => Promise<number>> = {
    product: () => prisma.product.count({ where }),
    customer: () => prisma.customer.count({ where }),
    route: () => prisma.route.count({ where }),
    priceList: () => prisma.priceList.count({ where }),
  };
  if ((await counts[model]()) !== unique.length) throw new NotFoundError(missingMessages[model]);
}
