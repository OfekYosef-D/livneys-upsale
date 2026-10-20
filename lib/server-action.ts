import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { z, ZodType } from 'zod';
import { appendAuditLog, type RecordAudit } from '@/features/audit/log';
import { actionError, actionOk, type ActionResult } from './action-result';
import { assertAdminAction, assertCustomerAction, type AuthenticatedSession } from './authorization';

export type ActionContext = {
  session: AuthenticatedSession;
  actorUserId: string;
  /** Shared by every audit entry written during one action, so related changes can be correlated. */
  requestId: string;
  audit: RecordAudit;
};

type Handler<S extends ZodType, R> = (input: z.output<S>, context: ActionContext) => Promise<R>;

function createContext(session: AuthenticatedSession): ActionContext {
  const requestId = randomUUID();
  const actorUserId = session.user.id;
  return {
    session,
    actorUserId,
    requestId,
    audit: (tx, entry) => appendAuditLog(tx, { actorUserId, actorRole: session.user.role, requestId, ...entry }),
  };
}

/**
 * Every page is rendered per request, so a successful mutation only needs to drop the
 * client router cache. Revalidating the root layout covers all pages and keeps actions
 * free of hand-maintained path lists.
 */
function refreshAllPages() {
  revalidatePath('/', 'layout');
}

/**
 * Template for every admin server action: authorize → validate (Zod) → run → refresh → map errors.
 * Use as `export const fooAction = adminAction(schema, async (input, ctx) => …)` in a 'use server' file.
 */
export function adminAction<S extends ZodType, R>(schema: S, handler: Handler<S, R>) {
  return async (input: unknown): Promise<ActionResult<R>> => {
    try {
      const session = await assertAdminAction();
      const result = await handler(schema.parse(input), createContext(session));
      refreshAllPages();
      return actionOk(result);
    } catch (error) {
      return actionError(error);
    }
  };
}

/** Customer actions are scoped to the `customerId` in the payload, which must match the signed-in user. */
export function customerAction<S extends ZodType<{ customerId: string }>, R>(schema: S, handler: Handler<S, R>) {
  return async (input: unknown): Promise<ActionResult<R>> => {
    try {
      const parsed = schema.parse(input);
      const session = await assertCustomerAction(parsed.customerId);
      const result = await handler(parsed, createContext(session));
      refreshAllPages();
      return actionOk(result);
    } catch (error) {
      return actionError(error);
    }
  };
}

/** Unauthenticated actions (login help, registration). Rate limiting is the handler's responsibility. */
export function publicAction<S extends ZodType, R>(schema: S, handler: (input: z.output<S>) => Promise<R>) {
  return async (input: unknown): Promise<ActionResult<R>> => {
    try {
      return actionOk(await handler(schema.parse(input)));
    } catch (error) {
      return actionError(error);
    }
  };
}
