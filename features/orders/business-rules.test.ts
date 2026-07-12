import { describe, expect, it } from 'vitest';
import {
  MINIMUM_INSTITUTIONAL_ORDER_TOTAL,
  validateInstitutionalOrderRules,
} from './business-rules';

const products = [
  { id: 'spread-185', name: '185g spread', orderMultiple: 6 },
  { id: 'case-500', name: '500g institutional jar', orderMultiple: 4 },
];

describe('institutional order business rules', () => {
  it('allows institutional customer orders at or above the minimum total', () => {
    expect(() =>
      validateInstitutionalOrderRules({
        source: 'CUSTOMER',
        total: MINIMUM_INSTITUTIONAL_ORDER_TOTAL,
        items: [{ productId: 'spread-185', quantity: 6 }],
        products,
      }),
    ).not.toThrow();
  });

  it('blocks customer order submission below the owner minimum total before VAT', () => {
    expect(() =>
      validateInstitutionalOrderRules({
        source: 'CUSTOMER',
        total: 699.99,
        items: [{ productId: 'spread-185', quantity: 6 }],
        products,
      }),
    ).toThrow('700');
  });

  it('enforces product order multiples for customer and admin submissions', () => {
    expect(() =>
      validateInstitutionalOrderRules({
        source: 'ADMIN',
        total: 900,
        items: [{ productId: 'spread-185', quantity: 7 }],
        products,
      }),
    ).toThrow('6');
  });
});
