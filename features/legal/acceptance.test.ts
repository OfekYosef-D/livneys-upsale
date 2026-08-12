import { describe, expect, it, vi } from 'vitest';
import { legalDocuments, LEGAL_DOCUMENT_SET_VERSION } from './documents';
import { assertLegalDocumentsApprovedForProduction, recordOrderLegalAcceptances } from './acceptance';

describe('versioned legal acceptance', () => {
  it('stores the version and SHA-256 hash of every displayed document', async () => {
    const createMany = vi.fn(async (_input: { data: unknown[] }) => ({ count: legalDocuments.length }));
    const tx = { legalAcceptance: { createMany } };
    const acceptedAt = new Date('2026-08-12T09:00:00.000Z');

    await recordOrderLegalAcceptances(tx as never, {
      orderId: 'order-1', customerId: 'cust-1', userId: 'user-1', acceptedAt,
    });

    expect(createMany).toHaveBeenCalledOnce();
    const rows = createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(expect.arrayContaining(legalDocuments.map((document) => expect.objectContaining({
      documentType: document.type,
      documentVersion: document.version,
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      acceptedAt,
    }))));
  });

  it('blocks only a real production deployment until counsel-approved copy is declared', () => {
    expect(() => assertLegalDocumentsApprovedForProduction({ VERCEL_ENV: 'preview' })).not.toThrow();
    expect(() => assertLegalDocumentsApprovedForProduction({ VERCEL_ENV: 'production' })).toThrow();
    expect(() => assertLegalDocumentsApprovedForProduction({
      VERCEL_ENV: 'production',
      LEGAL_DOCUMENTS_APPROVED_VERSION: LEGAL_DOCUMENT_SET_VERSION,
    })).not.toThrow();
  });
});
