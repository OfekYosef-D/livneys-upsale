import { describe, expect, it } from 'vitest';
import { getReceiptAmountForOutstanding } from './receipt-amount';
import fs from 'node:fs';
import path from 'node:path';

describe('admin payment receipt amount', () => {
  it('tracks the refreshed outstanding balance and clears a paid order', () => {
    expect(getReceiptAmountForOutstanding(40)).toBe('40');
    expect(getReceiptAmountForOutstanding(40.25)).toBe('40.25');
    expect(getReceiptAmountForOutstanding(0)).toBe('');
  });

  it('keeps a client-generated idempotency key until a receipt succeeds', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'features', 'payments', 'components', 'AdminPaymentReceipts.tsx'), 'utf8');
    expect(source).toContain('const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())');
    expect(source).toContain('idempotencyKey,');
    expect(source).toContain('setIdempotencyKey(crypto.randomUUID())');
  });
});
