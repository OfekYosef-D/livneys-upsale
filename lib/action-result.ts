import { ZodError } from 'zod';
import { AuthorizationError } from './authorization';
import { SafeActionError } from './safe-action-error';

export { SafeActionError } from './safe-action-error';

export type ActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      details?: Record<string, string | number | boolean | null>;
    };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError(error: unknown): ActionResult<never> {
  if (error instanceof SafeActionError) {
    return {
      ok: false,
      code: error.code,
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  if (error instanceof AuthorizationError) {
    return { ok: false, error: error.message };
  }

  if (error instanceof ZodError) {
    return { ok: false, error: 'הנתונים שנשלחו אינם תקינים.' };
  }

  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }

  return { ok: false, error: 'אירעה שגיאה לא צפויה.' };
}
