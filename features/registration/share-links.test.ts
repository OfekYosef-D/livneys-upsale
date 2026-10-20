import { describe, expect, it } from 'vitest';
import { buildWhatsAppUrl, toWhatsAppPhone } from '@/lib/whatsapp-link';
import { buildLoginInviteMessage, buildRegistrationInviteMessage, getLoginUrl, getRegistrationUrl } from './share-links';

describe('registration share links', () => {
  it('builds absolute registration and login urls', () => {
    expect(getRegistrationUrl('https://livneys-upsale.vercel.app')).toBe(
      'https://livneys-upsale.vercel.app/register',
    );
    expect(getLoginUrl('https://livneys-upsale.vercel.app/')).toBe(
      'https://livneys-upsale.vercel.app/login',
    );
  });

  it('normalizes israeli phone numbers for WhatsApp', () => {
    expect(toWhatsAppPhone('050-1111111')).toBe('972501111111');
    expect(toWhatsAppPhone('+972 50-111-1111')).toBe('972501111111');
    expect(toWhatsAppPhone('12')).toBeNull();
  });

  it('builds WhatsApp urls with and without a phone', () => {
    expect(buildWhatsAppUrl('050-1111111', 'שלום')).toBe(
      `https://wa.me/972501111111?text=${encodeURIComponent('שלום')}`,
    );
    expect(buildWhatsAppUrl(null, 'שלום')).toBe(
      `https://wa.me/?text=${encodeURIComponent('שלום')}`,
    );
  });

  it('builds hebrew invite messages', () => {
    expect(buildRegistrationInviteMessage('https://example.com')).toContain(
      'https://example.com/register',
    );
    expect(buildLoginInviteMessage('https://example.com')).toContain(
      'https://example.com/login',
    );
  });
});
