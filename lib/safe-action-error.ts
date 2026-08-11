export class SafeActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, string | number | boolean | null>,
  ) {
    super(message);
    this.name = 'SafeActionError';
  }
}
