import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError, getPrismaErrorCode, type ErrorCode, type ErrorDetails } from './errors';

export type ActionFailure = {
  ok: false;
  error: string;
  code: ErrorCode;
  requestId?: string;
  details?: ErrorDetails;
};

export type ActionResult<T> = { ok: true; data: T } | ActionFailure;

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** Maps any thrown value to a result that is safe to send to the browser. */
export function actionError(error: unknown): ActionFailure {
  if (error instanceof AppError) {
    return {
      ok: false,
      code: error.code,
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  if (error instanceof ZodError) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      error: error.issues[0]?.message ?? 'הנתונים שנשלחו אינם תקינים.',
    };
  }

  const prismaCode = getPrismaErrorCode(error);
  if (prismaCode === 'P2002') {
    return { ok: false, code: 'CONFLICT', error: 'כבר קיימת רשומה עם אותם פרטים (למשל אימייל או מק״ט).' };
  }
  if (prismaCode === 'P2025') {
    return { ok: false, code: 'NOT_FOUND', error: 'הרשומה לא נמצאה. רעננו את המסך ונסו שוב.' };
  }

  const requestId = randomUUID();
  console.error('Server action failed', { requestId, error });
  return {
    ok: false,
    code: 'INTERNAL_ERROR',
    error: 'אירעה שגיאה בלתי צפויה. נסו שוב או פנו לתמיכה.',
    requestId,
  };
}
