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
});
