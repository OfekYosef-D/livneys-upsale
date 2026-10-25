import { Spinner } from '@/components/ui/Spinner';

export function PageLoading({
  variant = 'page',
  label = 'טוען…',
}: {
  variant?: 'page' | 'portal';
  label?: string;
}) {
  if (variant === 'portal') {
    return (
      <main id="main-content" tabIndex={-1} className="app-surface min-h-screen text-black" aria-busy="true" aria-live="polite">
        <span className="sr-only">{label}</span>
        <section className="sticky top-0 z-30 border-b border-[var(--pantry-line)] bg-white px-3 py-2.5 md:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="ui-skeleton h-10 w-10 shrink-0 rounded-md" />
              <div className="space-y-1.5">
                <span className="ui-skeleton h-3 w-28" />
                <span className="ui-skeleton h-2.5 w-40" />
              </div>
            </div>
            <span className="ui-skeleton h-10 w-16 rounded-md" />
          </div>
        </section>
        <div className="mx-auto max-w-5xl px-3 py-3 md:px-6">
          <span className="ui-skeleton mb-3 h-12 w-full rounded-md" />
          <span className="ui-skeleton mb-2 h-10 w-full rounded-md" />
          <div className="mb-3 flex gap-1">
            <span className="ui-skeleton h-8 w-24 rounded-md" />
            <span className="ui-skeleton h-8 w-20 rounded-md" />
            <span className="ui-skeleton h-8 w-28 rounded-md" />
          </div>
          <div className="ui-panel divide-y divide-[var(--pantry-line)]">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="grid grid-cols-[5.25rem_1fr] gap-3 p-3">
                <span className="ui-skeleton aspect-square rounded-md" />
                <div className="space-y-2 py-1">
                  <span className="ui-skeleton h-2.5 w-16" />
                  <span className="ui-skeleton h-3.5 w-44 max-w-full" />
                  <span className="ui-skeleton h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="app-surface grid min-h-screen place-items-center px-4" aria-busy="true" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-medium text-black/60">
        <Spinner size={18} />
        {label}
      </p>
    </main>
  );
}
