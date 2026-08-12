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
    <main className="app-surface min-h-screen px-4 py-8 text-black">
      <article className="mx-auto max-w-3xl rounded-3xl border border-black/10 bg-white p-5 shadow-[0_18px_54px_rgba(0,0,0,0.06)] md:p-8">
        <p className="text-xs font-black text-black/45">גרסה {document.version}</p>
        <h1 className="mt-1 text-3xl font-black">{document.title}</h1>
        {!isApprovedProductionVersion && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            נוסח תפעולי לבדיקת המערכת. אין לפרסם ללקוחות אמיתיים לפני אישור עורך דין והגדרת הגרסה המאושרת בסביבת Production.
          </p>
        )}
        <div className="mt-6 space-y-6">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-black">{section.heading}</h2>
              <p className="mt-2 text-sm font-medium leading-7 text-black/70">{section.body}</p>
            </section>
          ))}
        </div>
        <Link href="/" className="mt-8 inline-flex min-h-10 items-center rounded-full bg-black px-5 text-sm font-black text-white">
          חזרה לאתר
        </Link>
      </article>
    </main>
  );
}
