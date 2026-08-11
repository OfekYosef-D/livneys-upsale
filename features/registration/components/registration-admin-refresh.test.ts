import { describe, expect, it, vi } from 'vitest';
import { refreshAfterRegistrationMutation } from './registration-admin-refresh';

describe('registration administration refresh', () => {
  it('refreshes server data after either a successful or failed mutation', () => {
    const refresh = vi.fn();

    refreshAfterRegistrationMutation({ refresh });

    expect(refresh).toHaveBeenCalledOnce();
  });
});
