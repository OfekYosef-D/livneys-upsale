import type { ReactNode } from 'react';

const tones = {
  info: 'border-sky-200 bg-sky-50 text-sky-950',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  danger: 'border-red-200 bg-red-50 text-red-900',
  neutral: 'border-[var(--pantry-line)] bg-[var(--pantry-soft)] text-black/75',
} as const;

export type NoticeTone = keyof typeof tones;

/** Inline status / feedback banner. Errors are announced immediately, other tones politely. */
export function Notice({
  tone = 'neutral',
  icon,
  title,
  children,
  className = '',
}: {
  tone?: NoticeTone;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm leading-6 ${tones[tone]} ${className}`}>
      {icon && <span className="mt-1 shrink-0" aria-hidden="true">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'text-xs leading-5 opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  );
}

/** Renders the last action outcome, colored by success or failure. */
export function ActionFeedback({ feedback, className }: { feedback: { ok: boolean; message: string } | null; className?: string }) {
  if (!feedback) return null;
  return <Notice tone={feedback.ok ? 'success' : 'danger'} className={className}>{feedback.message}</Notice>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 text-xs text-black/50">{description}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
