import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('VAT preview integration', () => {
  it('uses the configured effective rate for manual orders', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'features', 'admin-crm', 'components', 'AdminCrmManagers.tsx'), 'utf8');
    expect(source).toContain('calculateVatSummary(pricing.total, data.vatRatePercent)');
    expect(source).toContain('vatRatePercent: data.vatRatePercent');
  });

  it('uses the order snapshot rate for addition previews', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'features', 'order-additions', 'components', 'AdditionCatalogClient.tsx'), 'utf8');
    expect(source).toContain('calculateVatSummary(payment.total, order.vatRatePercent)');
  });

  it('submits the VAT rate that the customer reviewed', () => {
    const clientSource = fs.readFileSync(path.join(process.cwd(), 'components', 'customer', 'ReviewOrderClient.tsx'), 'utf8');
    const actionSource = fs.readFileSync(path.join(process.cwd(), 'features', 'customer-portal', 'actions.ts'), 'utf8');
    expect(clientSource).toContain('vatRatePercent,');
    expect(clientSource).toContain('legalDocumentSetVersion: LEGAL_DOCUMENT_SET_VERSION');
    expect(actionSource).toContain('expectedVatRatePercent: parsed.vatRatePercent');
    expect(actionSource).toContain('expectedLegalDocumentSetVersion: parsed.legalDocumentSetVersion');
  });
});

describe('external product image integration', () => {
  it.each([
    ['components', 'customer', 'ProductCard.tsx'],
    ['components', 'customer', 'CustomerCatalogApp.tsx'],
    ['features', 'order-additions', 'components', 'AdditionCatalogClient.tsx'],
  ])('renders configured external images without the Next optimizer allowlist: %s', (...segments) => {
    const source = fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');
    expect(source).toContain("unoptimized={Boolean(product.imageUrl?.startsWith('http'))}");
  });
});
