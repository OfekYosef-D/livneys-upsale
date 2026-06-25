import { describe, expect, it } from 'vitest';
import { formatRouteDeadline, isAfterCutoff } from './utils';

describe('route utilities', () => {
  it('classifies orders after cutoff as late using absolute cutoff time', () => {
    expect(
      isAfterCutoff({
        now: new Date('2026-06-23T15:01:00.000Z'),
        cutoff: new Date('2026-06-23T15:00:00.000Z'),
      }),
    ).toBe(true);
  });

  it('formats route cutoff in Hebrew Israel time', () => {
    expect(formatRouteDeadline(new Date('2026-06-23T15:00:00.000Z'))).toContain('18:00');
  });
});
