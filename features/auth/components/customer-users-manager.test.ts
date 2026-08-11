import { describe, expect, it, vi } from 'vitest';
import { completeSuccessfulInvite } from './customer-users-manager-helpers';

describe('customer user invitation UI', () => {
  it('clears the form and refreshes the server account list after a successful invite', () => {
    const reset = vi.fn();
    const refresh = vi.fn();

    completeSuccessfulInvite({ reset }, { refresh });

    expect(reset).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
