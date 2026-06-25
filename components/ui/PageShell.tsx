import type React from 'react';
export function PageShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <main className="app-surface min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-4 border-b border-black/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-normal text-black/50">Livney&apos;s B2B</p>
            <h1 className="text-3xl font-black tracking-normal md:text-4xl">{title}</h1>
            {subtitle && <p className="mt-2 max-w-2xl text-black/60">{subtitle}</p>}
          </div>
          {actions}
        </header>
        {children}
      </div>
    </main>
  );
}
