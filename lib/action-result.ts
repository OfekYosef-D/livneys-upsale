import { ZodError } from 'zod';
import { AuthorizationError } from '@/lib/authorization';

export type ActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError(error: unknown): ActionResult<never> {
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
