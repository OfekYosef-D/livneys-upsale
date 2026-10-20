import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({ Heebo: () => ({ variable: 'font-heebo', className: 'font-heebo' }) }));
vi.mock('@/components/ui/NavigationProgress', () => ({ NavigationProgress: () => null }));

describe('nonce CSP rendering contract', () => {
  it('forces the root application tree to render per request', async () => {
    const layout = await import('@/app/layout');

    expect(layout.dynamic).toBe('force-dynamic');
  });
});
