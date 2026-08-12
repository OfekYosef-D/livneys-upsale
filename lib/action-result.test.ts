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

  it('returns only a safe code and request id for unexpected failures', () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = actionError(new Error('postgresql://user:secret@db.example/internal-table'));

    expect(result).toMatchObject({
      ok: false,
      code: 'INTERNAL_ERROR',
      error: 'אירעה שגיאה בלתי צפויה. נסו שוב או פנו לתמיכה.',
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(errorLog).toHaveBeenCalledWith('Server action failed', expect.objectContaining({
      requestId: result.ok ? undefined : result.requestId,
      error: expect.any(Error),
    }));
    errorLog.mockRestore();
  });
});
