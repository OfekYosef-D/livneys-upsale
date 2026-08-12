import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('VAT preview integration', () => {
  it('uses the configured effective rate for manual orders', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'features', 'admin-crm', 'components', 'AdminCrmManagers.tsx'), 'utf8');
    expect(source).toContain('calculateVatSummary(pricing.total, data.vatRatePercent)');
  });

  it('uses the order snapshot rate for addition previews', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'features', 'order-additions', 'components', 'AdditionCatalogClient.tsx'), 'utf8');
    expect(source).toContain('calculateVatSummary(payment.total, order.vatRatePercent)');
  });
});
