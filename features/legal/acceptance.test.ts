import { describe, expect, it, vi } from 'vitest';
import { legalDocuments, LEGAL_DOCUMENT_SET_VERSION } from './documents';
import { assertLegalDocumentsApprovedForProduction, hashLegalDocument, recordOrderLegalAcceptances } from './acceptance';
import { getLegalDocument } from './documents';

describe('versioned legal acceptance', () => {
  it('stores the version and SHA-256 hash of every displayed document', async () => {
    const createMany = vi.fn(async (_input: { data: unknown[] }) => ({ count: legalDocuments.length }));
    const tx = { legalAcceptance: { createMany } };
    const acceptedAt = new Date('2026-08-12T09:00:00.000Z');

    await recordOrderLegalAcceptances(tx as never, {
      orderId: 'order-1', customerId: 'cust-1', userId: 'user-1', acceptedAt,
      expectedDocumentSetVersion: LEGAL_DOCUMENT_SET_VERSION,
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

  it('rejects an acceptance submitted from a stale legal review screen', async () => {
    const createMany = vi.fn();
    await expect(recordOrderLegalAcceptances({ legalAcceptance: { createMany } } as never, {
      orderId: 'order-1', customerId: 'cust-1', userId: 'user-1', acceptedAt: new Date(),
      expectedDocumentSetVersion: 'previous-version',
    })).rejects.toMatchObject({
      code: 'STALE_VERSION',
      message: 'התנאים עודכנו מאז שפתחתם את המסך. רעננו ועברו שוב על הנוסח העדכני.',
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('blocks only a real production deployment until counsel-approved copy is declared', () => {
    expect(() => assertLegalDocumentsApprovedForProduction({ VERCEL_ENV: 'preview' })).not.toThrow();
    expect(() => assertLegalDocumentsApprovedForProduction({ VERCEL_ENV: 'production' })).toThrow(expect.objectContaining({
      code: 'LEGAL_DOCUMENTS_NOT_APPROVED',
      message: 'לא ניתן לקבל הזמנות לפני אישור ופרסום הנוסח המשפטי העדכני.',
    }));
    expect(() => assertLegalDocumentsApprovedForProduction({
      VERCEL_ENV: 'production', LEGAL_DOCUMENTS_APPROVED_VERSION: 'older-version',
    })).toThrow(expect.objectContaining({ code: 'LEGAL_DOCUMENTS_NOT_APPROVED' }));
    expect(() => assertLegalDocumentsApprovedForProduction({
      VERCEL_ENV: 'production',
      LEGAL_DOCUMENTS_APPROVED_VERSION: LEGAL_DOCUMENT_SET_VERSION,
    })).not.toThrow();
  });

  it('hashes each document deterministically and changes the hash when the wording changes', () => {
    const [document] = legalDocuments;
    expect(hashLegalDocument(document)).toBe(hashLegalDocument({ ...document }));
    expect(hashLegalDocument({ ...document, sections: [...document.sections, { heading: 'x', body: 'y' }] }))
      .not.toBe(hashLegalDocument(document));
    expect(new Set(legalDocuments.map(hashLegalDocument)).size).toBe(legalDocuments.length);
  });

  it('resolves documents by slug only', () => {
    expect(getLegalDocument('privacy')).toMatchObject({ type: 'PRIVACY_POLICY' });
    expect(getLegalDocument('PRIVACY_POLICY')).toBeNull();
  });

  it('serves readable Hebrew copy (no mojibake)', () => {
    for (const document of legalDocuments) {
      expect(document.title).toMatch(/[֐-׿]/);
      expect(JSON.stringify(document)).not.toMatch(/×|�/);
    }
  });
});
