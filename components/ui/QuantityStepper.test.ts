import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QuantityStepper } from './QuantityStepper';

describe('QuantityStepper', () => {
  it('renders the quantity as a directly editable numeric-keyboard field', () => {
    const html = renderToStaticMarkup(
      createElement(QuantityStepper, {
        value: 12,
        min: 6,
        step: 6,
        onChange: vi.fn(),
      }),
    );

    expect(html).toContain('aria-label="כמות להזמנה"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('pattern="[0-9]*"');
    expect(html).toContain('enterKeyHint="done"');
    expect(html).toContain('value="12"');
  });

  it('rejects a typed quantity that is not a valid order multiple', async () => {
    const quantityModule: Record<string, unknown> = await import('./QuantityStepper');
    const parseOrderQuantity = quantityModule.parseOrderQuantity as
      | ((draft: string, min: number, step: number) => number | null)
      | undefined;

    expect(parseOrderQuantity?.('13', 6, 6)).toBeNull();
    expect(parseOrderQuantity?.('24', 6, 6)).toBe(24);
    expect(parseOrderQuantity?.('0', 6, 6)).toBe(0);
  });
});
