import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLegalDocument } from '@/features/legal/documents';
import { LEGAL_DOCUMENT_SET_VERSION } from '@/features/legal/documents';

export default async function LegalDocumentPage({ params }: { params: Promise<{ document: string }> }) {
  const { document: slug } = await params;
  const document = getLegalDocument(slug);
  if (!document) notFound();
  const isApprovedProductionVersion = process.env.VERCEL_ENV === 'production'
    && process.env.LEGAL_DOCUMENTS_APPROVED_VERSION === LEGAL_DOCUMENT_SET_VERSION;

  return (
    <main id="main-content" tabIndex={-1} className="app-surface min-h-screen px-4 py-8 text-black">
      <article className="ui-panel mx-auto max-w-3xl p-5 md:p-8">
        <p className="text-xs font-medium text-black/60">גרסה {document.version}</p>
        <h1 className="mt-1 text-2xl font-semibold">{document.title}</h1>
        {!isApprovedProductionVersion && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            נוסח תפעולי לבדיקת המערכת. אין לפרסם ללקוחות אמיתיים לפני אישור עורך דין והגדרת הגרסה המאושרת בסביבת Production.
          </p>
        )}
        <div className="mt-6 space-y-6">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold">{section.heading}</h2>
              <p className="mt-2 text-sm font-medium leading-7 text-black/70">{section.body}</p>
            </section>
          ))}
        </div>
        <Link href="/" className="mt-8 inline-flex min-h-10 items-center rounded-md bg-black px-5 text-sm font-semibold text-white">
          חזרה לאתר
        </Link>
      </article>
    </main>
  );
}
