import { describe, expect, it } from 'vitest';
import { getPreloadedCartNotice } from './cart-origin';

describe('getPreloadedCartNotice', () => {
  it('explains that a submitted order was loaded as an editable reorder baseline', () => {
    expect(getPreloadedCartNotice({ status: 'SUBMITTED', orderNumber: 1010, itemCount: 54 })).toBe(
      'סל הזמנה #1010 נטען לנוחותך כהזמנה חוזרת. בדקו ועדכנו כמויות לפני שליחה כדי למנוע הזמנה כפולה.',
    );
  });

  it('distinguishes a saved draft from a previous submitted order', () => {
    expect(getPreloadedCartNotice({ status: 'DRAFT', orderNumber: null, itemCount: 12 })).toBe(
      'הטיוטה השמורה שלך נטענה. בדקו ועדכנו כמויות לפני המעבר לסקירת ההזמנה.',
    );
  });

  it('does not show a notice for an empty cart', () => {
    expect(getPreloadedCartNotice({ status: 'SUBMITTED', orderNumber: 1010, itemCount: 0 })).toBeNull();
  });
});
