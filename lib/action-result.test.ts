import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { actionError, actionOk } from './action-result';
import { AppError, AuthorizationError, StaleVersionError } from './errors';

describe('safe action errors', () => {
  it('wraps successful data', () => {
    expect(actionOk({ id: 'x' })).toEqual({ ok: true, data: { id: 'x' } });
  });

  it('returns a stable code and public details without exposing an internal stack', () => {
    const result = actionError(new AppError(
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

  it('passes through AppError subclasses with their Hebrew message and no details key', () => {
    expect(actionError(new AuthorizationError())).toEqual({
      ok: false, code: 'UNAUTHORIZED', error: 'אין הרשאה לבצע פעולה זו.',
    });
    expect(actionError(new StaleVersionError())).toMatchObject({ ok: false, code: 'STALE_VERSION' });
  });

  it('maps a ZodError to its first issue message', () => {
    const parsed = z.object({ email: z.string().email('כתובת אימייל לא תקינה.') }).safeParse({ email: 'nope' });
    expect(parsed.success).toBe(false);
    expect(actionError(parsed.error)).toEqual({
      ok: false, code: 'VALIDATION_ERROR', error: 'כתובת אימייל לא תקינה.',
    });
  });

  it('maps Prisma unique and missing-record errors to safe codes', () => {
    expect(actionError(Object.assign(new Error('Unique constraint failed on users_email_key'), { code: 'P2002' })))
      .toMatchObject({ ok: false, code: 'CONFLICT' });
    const notFound = actionError(Object.assign(new Error('No record found for an update'), { code: 'P2025' }));
    expect(notFound).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(JSON.stringify(notFound)).not.toContain('No record found');
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
      requestId: result.requestId,
      error: expect.any(Error),
    }));
    errorLog.mockRestore();
  });
});
