'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Modal dialog: focus moves inside on open, Escape and the backdrop close it, and page scroll is locked. */
export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  size = 'md',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-3 py-6">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="סגירה" tabIndex={-1} onClick={onClose} />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-md border border-[var(--pantry-line)] bg-white shadow-[var(--shadow-dialog)] ${size === 'lg' ? 'max-w-3xl' : 'max-w-2xl'}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--pantry-line)] px-4 py-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm leading-6 text-black/60">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--pantry)] hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25">
            <X aria-hidden="true" size={16} />
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
      </section>
    </div>
  );
}
