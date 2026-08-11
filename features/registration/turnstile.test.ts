import { describe, expect, it, vi } from 'vitest';
import { resetTurnstileChallenge } from './turnstile';

describe('registration Turnstile challenge', () => {
  it('resets the single-use widget token after a failed submission', () => {
    const reset = vi.fn();

    resetTurnstileChallenge({ turnstile: { reset } });

    expect(reset).toHaveBeenCalledOnce();
  });

  it('is safe while the Turnstile script is still unavailable', () => {
    expect(() => resetTurnstileChallenge({})).not.toThrow();
  });
});
