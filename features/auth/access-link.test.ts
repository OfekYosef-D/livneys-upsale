import { describe, expect, it } from 'vitest';
import { buildAccessLinkMessage } from './access-link';

describe('buildAccessLinkMessage', () => {
  it('greets the contact and states how long each kind of link is valid', () => {
    const setup = buildAccessLinkMessage({ contact: 'דנה', url: 'https://x.test/setup-password?token=a', type: 'PASSWORD_SETUP' });
    expect(setup).toContain('שלום דנה');
    expect(setup).toContain('https://x.test/setup-password?token=a');
    expect(setup).toContain('24 שעות');

    expect(buildAccessLinkMessage({ contact: 'דנה', url: 'u', type: 'PASSWORD_RESET' })).toContain('30 דקות');
  });
});
