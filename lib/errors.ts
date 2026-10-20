export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INVALID_TOKEN'
  | 'DELIVERY_UNAVAILABLE'
  | 'ORDER_LOCKED'
  /** The record is in a state that does not allow this action (e.g. already sent, inactive). */
  | 'INVALID_STATE'
  | 'STALE_VERSION'
  | 'ACTIVE_ORDER_EXISTS'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'PAYMENT_EXCEEDS_BALANCE'
  | 'TAX_RATE_NOT_CONFIGURED'
  | 'LEGAL_DOCUMENTS_NOT_APPROVED'
  | 'INTERNAL_ERROR';

export type ErrorDetails = Record<string, string | number | boolean | null>;

/**
 * An expected, user-facing failure. Its message is Hebrew copy that is safe to show
 * to the end user as-is; anything that is not an AppError is treated as an internal
 * error and replaced with a generic message plus a request id.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'אין הרשאה לבצע פעולה זו.') {
    super('UNAUTHORIZED', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
  }
}

export class StaleVersionError extends AppError {
  constructor(message = 'הנתונים השתנו בזמן הפעולה. רעננו את המסך ונסו שוב.') {
    super('STALE_VERSION', message);
  }
}

/** Prisma error codes surfaced as user-facing conflicts rather than internal errors. */
export function getPrismaErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}
