'use client';

import Link from 'next/link';
import { Edit3, Eye, Plus, Power, Save, Search } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { useServerAction } from '@/components/hooks/useServerAction';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ActionFeedback } from '@/components/ui/Notice';
import { Toolbar } from '@/components/ui/Toolbar';
import type { StatusFilter, useListView } from './list-view';

type ListView = ReturnType<typeof useListView<object, string>>;

/** Which record (if any) the edit dialog is showing. */
export type DialogTarget = { mode: 'create' } | { mode: 'edit'; id: string } | null;

export function useDialogTarget() {
  const [target, setTarget] = useState<DialogTarget>(null);
  return {
    target,
    editingId: target?.mode === 'edit' ? target.id : null,
    openCreate: () => setTarget({ mode: 'create' }),
    openEdit: (id: string) => setTarget({ mode: 'edit', id }),
    close: () => setTarget(null),
  };
}

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'הכל' },
  { value: 'active', label: 'פעילים' },
  { value: 'inactive', label: 'לא פעילים' },
];

export function ListToolbar({
  view,
  searchPlaceholder,
  createLabel,
  onCreate,
  showStatus = true,
  children,
}: {
  view: Pick<ListView, 'search' | 'setSearch' | 'status' | 'setStatus' | 'visible' | 'total'>;
  searchPlaceholder: string;
  createLabel?: string;
  onCreate?: () => void;
  showStatus?: boolean;
  children?: ReactNode;
}) {
  return (
    <Toolbar>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[13rem] flex-1 md:max-w-xs">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35" size={15} />
          <input value={view.search} onChange={(event) => view.setSearch(event.target.value)} placeholder={searchPlaceholder} className="ui-field min-h-9 bg-[var(--pantry-soft)] pr-9" />
        </label>
        {showStatus && (
          <div className="flex gap-0.5" role="radiogroup" aria-label="סטטוס">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={view.status === option.value}
                onClick={() => view.setStatus(option.value)}
                className={`min-h-9 rounded-md px-3 text-xs font-medium ${view.status === option.value ? 'bg-black text-white' : 'text-black/60 hover:bg-[var(--pantry)]'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {children}
        <span className="ms-auto text-[11px] tabular-nums text-black/60">{view.visible.length}/{view.total}</span>
        {createLabel && onCreate && <Button size="sm" onClick={onCreate} icon={<Plus size={15} />}>{createLabel}</Button>}
      </div>
    </Toolbar>
  );
}

export function ToolbarSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="flex min-h-9 items-center gap-2 rounded-md border border-[var(--pantry-line)] bg-[var(--pantry-soft)] px-2.5 text-[11px] text-black/60">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-sm font-medium text-black outline-none">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

/** Facet dropdown with an "all" option, fed by useListView. */
export function FacetSelect({ view, facet, label, allLabel }: { view: Pick<ListView, 'facetOptions' | 'facetValue' | 'setFacet'>; facet: string; label: string; allLabel: string }) {
  const options = view.facetOptions[facet] ?? [];
  if (options.length < 2) return null;
  return (
    <ToolbarSelect
      label={label}
      value={view.facetValue(facet)}
      onChange={(value) => view.setFacet(facet, value)}
      options={[{ value: 'all', label: allLabel }, ...options.map((value) => ({ value, label: value }))]}
    />
  );
}

export function RowActions({ viewHref, onEdit, active, onToggle }: { viewHref?: string; onEdit?: () => void; active?: boolean; onToggle?: () => void }) {
  const actionClass = buttonClassName({ variant: 'ghost', size: 'sm' });
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {viewHref && <Link href={viewHref} className={actionClass}><Eye size={13} aria-hidden="true" /> צפייה</Link>}
      {onEdit && <button type="button" onClick={onEdit} className={actionClass}><Edit3 size={13} aria-hidden="true" /> עריכה</button>}
      {onToggle && active !== undefined && (
        <button
          type="button"
          className={actionClass}
          onClick={() => {
            const message = active ? 'להשבית? ההיסטוריה תישמר, והפריט לא יוצג ללקוחות.' : 'להפעיל מחדש?';
            if (window.confirm(message)) onToggle();
          }}
        >
          <Power size={13} aria-hidden="true" /> {active ? 'השבתה' : 'הפעלה'}
        </button>
      )}
    </div>
  );
}

/** Create/edit dialog with a native form, sticky save/cancel bar and inline feedback. */
export function FormDialog({
  open,
  title,
  description,
  action,
  onSubmit,
  onClose,
  children,
  impactNote,
}: {
  open: boolean;
  title: string;
  description?: string;
  action: ReturnType<typeof useServerAction>;
  onSubmit: (form: FormData) => void;
  onClose: () => void;
  children: ReactNode;
  impactNote?: ReactNode;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget));
  }

  return (
    <Dialog open={open} title={title} description={description} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {children}
        {impactNote && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">{impactNote}</p>}
        <ActionFeedback feedback={action.feedback?.ok === false ? action.feedback : null} />
        <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-[var(--pantry-line)] bg-white px-4 py-3 sm:-mx-5 sm:-mb-5 sm:px-5">
          <Button type="submit" pending={action.pending} pendingLabel="שומרים…" icon={<Save size={16} />}>שמירה</Button>
          <Button variant="secondary" onClick={onClose}>ביטול</Button>
        </div>
      </form>
    </Dialog>
  );
}
