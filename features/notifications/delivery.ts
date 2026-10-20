/** Shared contracts for outbound message providers. */

export type DeliveryResult = {
  /** dry-run = the channel is not configured for live sending; nothing left the system. */
  mode: 'dry-run' | 'live';
  providerMessageId: string | null;
};

/** A failure that retrying cannot fix (invalid address, missing template, rejected credentials). */
export class PermanentDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentDeliveryError';
  }
}

export function readEnvText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
