import { describe, expect, it, vi } from 'vitest';
import { getEmailConfig, sendEmailMessage } from './email';

describe('email sender', () => {
  it('uses dry-run mode when Resend credentials are absent', async () => {
    const fetchImpl = vi.fn();
    await expect(sendEmailMessage({ to: 'client@example.com', subject: 'עדכון', text: 'הודעה' }, {
      config: getEmailConfig({}), fetchImpl: fetchImpl as never,
    })).resolves.toEqual({ mode: 'dry-run', providerMessageId: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends through Resend with the verified sender', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'email-001' }) });
    await expect(sendEmailMessage({ to: 'client@example.com', subject: 'עדכון', text: 'הודעה' }, {
      config: getEmailConfig({ RESEND_API_KEY: 're_key', EMAIL_FROM: "Livney's <orders@example.com>" }),
      fetchImpl: fetchImpl as never,
    })).resolves.toEqual({ mode: 'live', providerMessageId: 'email-001' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));
  });
});
