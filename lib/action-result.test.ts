import { describe, expect, it, vi } from 'vitest';

vi.mock('./authorization', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));

const { actionError, SafeActionError } = await import('./action-result');

describe('safe action errors', () => {
  it('returns a stable code and public details without exposing an internal stack', () => {
    const result = actionError(new SafeActionError(
      'ACTIVE_ORDER_EXISTS',
      'כבר קיימת הזמנה למועד החלוקה הזה.',
      { orderId: 'order-1', orderNumber: 1001 },
    ));

    expect(result).toEqual({
      ok: false,
      code: 'ACTIVE_ORDER_EXISTS',
      error: 'כבר קיימת הזמנה למועד החלוקה הזה.',
      details: { orderId: 'order-1', orderNumber: 1001 },
    });
  });
});
