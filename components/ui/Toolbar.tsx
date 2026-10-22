import type React from 'react';

export function Toolbar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 border-b border-[var(--pantry-line)] bg-[var(--paper)] px-3 py-2.5 ${className}`}>
      {children}
    </div>
  );
}

export function KpiStrip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 divide-x divide-x-reverse divide-[var(--pantry-line)] border-b border-[var(--pantry-line)] bg-[var(--paper)] ${className || 'sm:grid-cols-3'}`}>
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  tone?: 'neutral' | 'warning' | 'success' | 'danger';
}) {
  const valueClass = {
    neutral: 'text-black',
    warning: 'text-amber-800',
    success: 'text-emerald-800',
    danger: 'text-red-800',
  }[tone];

  return (
    <div className="px-3 py-2.5">
      <p className="text-[11px] font-medium text-black/60">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums leading-none ${valueClass}`}>{value}</p>
      {detail && <p className="mt-1 text-[11px] text-black/60">{detail}</p>}
    </div>
  );
}

export function DefinitionList({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>;
}

export function DefinitionItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-black/60">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}
