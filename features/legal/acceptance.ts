import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppError, StaleVersionError } from '@/lib/errors';
import { isLegalVersionApproved, legalDocuments, LEGAL_DOCUMENT_SET_VERSION, type LegalDocumentDefinition } from './documents';

type LegalAcceptanceWriter = Pick<Prisma.TransactionClient, 'legalAcceptance'>;

/** The hash proves exactly which wording the customer accepted, even if the documents change later. */
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
    throw new StaleVersionError('התנאים עודכנו מאז שפתחתם את המסך. רעננו ועברו שוב על הנוסח העדכני.');
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

/** Production refuses customer orders until a lawyer-approved version is configured. */
export function assertLegalDocumentsApprovedForProduction(env: Record<string, string | undefined> = process.env): void {
  if (env.VERCEL_ENV !== 'production' || isLegalVersionApproved(env)) return;
  throw new AppError('LEGAL_DOCUMENTS_NOT_APPROVED', 'לא ניתן לקבל הזמנות לפני אישור ופרסום הנוסח המשפטי העדכני.');
}
