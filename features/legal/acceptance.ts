import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { SafeActionError } from '../../lib/safe-action-error';
import { legalDocuments, LEGAL_DOCUMENT_SET_VERSION, type LegalDocumentDefinition } from './documents';

type LegalAcceptanceWriter = Pick<Prisma.TransactionClient, 'legalAcceptance'>;

export function hashLegalDocument(document: LegalDocumentDefinition): string {
  const canonical = JSON.stringify({
    type: document.type,
    version: document.version,
    title: document.title,
    sections: document.sections,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export async function recordOrderLegalAcceptances(
  tx: LegalAcceptanceWriter,
  input: { orderId: string; customerId: string; userId: string; acceptedAt: Date; expectedDocumentSetVersion: string },
) {
  if (input.expectedDocumentSetVersion !== LEGAL_DOCUMENT_SET_VERSION) {
    throw new SafeActionError(
      'STALE_VERSION',
      '׳”׳×׳ ׳׳™׳ ׳¢׳•׳“׳›׳ ׳• ׳׳׳– ׳©׳₪׳×׳—׳×׳ ׳׳× ׳”׳׳¡׳. ׳¨׳¢׳ ׳ ׳• ׳•׳¢׳‘׳¨׳• ׳©׳•׳‘ ׳¢׳ ׳”׳ ׳•׳¡׳— ׳”׳¢׳“׳›׳ ׳™.',
    );
  }
  await tx.legalAcceptance.createMany({
    data: legalDocuments.map((document) => ({
      orderId: input.orderId,
      customerId: input.customerId,
      userId: input.userId,
      acceptedAt: input.acceptedAt,
      documentType: document.type,
      documentVersion: document.version,
      contentHash: hashLegalDocument(document),
    })),
  });
}

export function assertLegalDocumentsApprovedForProduction(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.VERCEL_ENV !== 'production') return;
  if (env.LEGAL_DOCUMENTS_APPROVED_VERSION === LEGAL_DOCUMENT_SET_VERSION) return;

  throw new SafeActionError(
    'LEGAL_DOCUMENTS_NOT_APPROVED',
    'לא ניתן לקבל הזמנות לפני אישור ופרסום הנוסח המשפטי העדכני.',
  );
}
