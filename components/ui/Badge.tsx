import type { ReactNode } from 'react';

export const badgeTones = {
  neutral: 'bg-[var(--pantry)] text-black/70',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-900',
  muted: 'bg-black/5 text-black/60',
  inverse: 'bg-black text-white',
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span className={`inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'success' : 'muted'}>{active ? 'פעיל' : 'לא פעיל'}</Badge>;
}
