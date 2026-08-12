import { MINIMUM_INSTITUTIONAL_ORDER_TOTAL } from '../owner-rules/constants';
import { SafeActionError } from '../../lib/safe-action-error';

export { MINIMUM_INSTITUTIONAL_ORDER_TOTAL };

export type InstitutionalOrderSource = 'CUSTOMER' | 'ADMIN';

export type InstitutionalOrderItem = {
  productId: string;
  quantity: number;
};

export type InstitutionalOrderProduct = {
  id: string;
  name: string;
  orderMultiple?: number | null;
};

export function validateInstitutionalOrderRules({
  source,
  total,
  items,
  products,
}: {
  source: InstitutionalOrderSource;
  total: number;
  items: InstitutionalOrderItem[];
  products: InstitutionalOrderProduct[];
}) {
  assertOrderMultiples({ items, products });

  if (source === 'CUSTOMER' && total < MINIMUM_INSTITUTIONAL_ORDER_TOTAL) {
    throw new SafeActionError('VALIDATION_ERROR', `מינימום הזמנה מוסדית הוא ${MINIMUM_INSTITUTIONAL_ORDER_TOTAL} ₪ לפני מע"מ.`);
  }
}

export function assertOrderMultiples({
  items,
  products,
}: {
  items: InstitutionalOrderItem[];
  products: InstitutionalOrderProduct[];
}) {
  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const item of items) {
    if (item.quantity <= 0) continue;

    const product = productsById.get(item.productId);
    if (!product) continue;

    const multiple = Math.max(1, Math.floor(product.orderMultiple ?? 1));
    if (multiple <= 1) continue;

    if (item.quantity % multiple !== 0) {
      throw new SafeActionError('VALIDATION_ERROR', `הכמות עבור ${product.name} חייבת להיות בכפולות של ${multiple}.`);
    }
  }
}
