import { describe, expect, it, vi } from 'vitest';
import { lockCustomerAccessState } from './customer-access-lock';

describe('customer access mutation lock', () => {
  it('takes a row lock before access-affecting customer mutations', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'customer-1', isActive: true }]);

    await expect(lockCustomerAccessState({ $queryRaw: queryRaw } as never, 'customer-1')).resolves.toEqual({
      id: 'customer-1',
      isActive: true,
    });

    const query = queryRaw.mock.calls[0][0] as { strings: string[]; values: unknown[] };
    expect(query.strings.join('')).toContain('FOR UPDATE');
    expect(query.values).toEqual(['customer-1']);
  });
});
