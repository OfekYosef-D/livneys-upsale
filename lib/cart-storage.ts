import type { Cart } from '@/lib/order-utils';

export function getCartStorageKey(customerId: string): string {
  return `livneys-cart-${customerId}`;
}

export function readStoredCart(customerId: string): Cart | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem(getCartStorageKey(customerId));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function writeStoredCart(customerId: string, cart: Cart): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getCartStorageKey(customerId), JSON.stringify(cart));
}

export function clearStoredCart(customerId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(getCartStorageKey(customerId));
}
