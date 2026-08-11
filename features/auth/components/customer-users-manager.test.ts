import { describe, expect, it, vi } from 'vitest';
import { completeSuccessfulInvite, refreshAfterInviteFailure } from './customer-users-manager-helpers';

describe('customer user invitation UI', () => {
  it('clears the form and refreshes the server account list after a successful invite', () => {
    const reset = vi.fn();
    const refresh = vi.fn();

    completeSuccessfulInvite({ reset }, { refresh });

    expect(reset).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('refreshes the account list when delivery fails after the account may have committed', () => {
    const refresh = vi.fn();

    refreshAfterInviteFailure({ refresh });

    expect(refresh).toHaveBeenCalledOnce();
  });
});
