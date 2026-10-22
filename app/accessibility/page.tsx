import type { Metadata } from 'next';
import Link from 'next/link';
import { accessibilityStatement as statement } from '@/features/legal/accessibility-statement';

export const metadata: Metadata = { title: "הצהרת נגישות | Livney's B2B" };

export default function AccessibilityStatementPage() {
  return (
    <main id="main-content" tabIndex={-1} className="app-surface min-h-screen px-4 py-8 text-black">
      <article className="ui-panel mx-auto max-w-3xl p-5 md:p-8">
        <h1 className="text-2xl font-semibold">{statement.title}</h1>
        <div className="mt-6 space-y-6">
          {statement.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold">{section.heading}</h2>
              {'paragraphs' in section && section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm font-medium leading-7 text-black/70">{paragraph}</p>
              ))}
              {'items' in section && (
                <ul className="mt-2 list-disc space-y-1 ps-5 text-sm font-medium leading-7 text-black/70">
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
          <section>
            <h2 className="text-base font-semibold">פרטי קשר</h2>
            <p className="mt-2 text-sm font-medium leading-7 text-black/70">
              טלפון: <a href={`tel:${statement.contactPhone.replaceAll('-', '')}`} dir="ltr" className="underline underline-offset-4">{statement.contactPhone}</a>
            </p>
          </section>
          <p className="text-xs text-black/60">
            ההצהרה עודכנה ב-{statement.updatedAt}. בדיקת הנגישות האחרונה בוצעה ב-{statement.auditedAt}.
          </p>
        </div>
        <Link href="/" className="mt-8 inline-flex min-h-10 items-center rounded-md bg-black px-5 text-sm font-semibold text-white">
          חזרה לאתר
        </Link>
      </article>
    </main>
  );
}
