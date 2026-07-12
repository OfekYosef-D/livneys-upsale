'use client';

import type React from 'react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Edit3, Eye, Plus, Power, Search, X } from 'lucide-react';
import type { AdminStatusFilter } from '@/features/admin-crm/ui-utils';

export function AdminCrudPageHeader({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)] sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm font-bold leading-6 text-black/55">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-black/25 sm:w-auto"
        >
          <Plus aria-hidden="true" size={16} />
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

export function AdminListToolbar({
  search,
  onSearch,
  status,
  onStatus,
  count,
  total,
  searchLabel = 'חיפוש',
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  status: AdminStatusFilter;
  onStatus: (value: AdminStatusFilter) => void;
  count: number;
  total: number;
  searchLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-3 shadow-[0_14px_42px_rgba(0,0,0,0.04)]">
      <label className="relative block w-full md:max-w-sm">
        <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35" size={17} />
        <input
          name="adminSearch"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={searchLabel}
          autoComplete="off"
          spellCheck={false}
          className="min-h-10 w-full rounded-full border border-black/10 bg-[#f7f5f1] py-2 pl-3 pr-10 text-sm font-bold outline-none focus:border-black focus:ring-2 focus:ring-black/10"
        />
      </label>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
          <StatusFilterButton label="הכל" active={status === 'all'} onClick={() => onStatus('all')} />
          <StatusFilterButton label="פעילים" active={status === 'active'} onClick={() => onStatus('active')} />
          <StatusFilterButton label="לא פעילים" active={status === 'inactive'} onClick={() => onStatus('inactive')} />
          <span className="shrink-0 rounded-full bg-[#e6e1d8] px-3 py-2 text-xs font-black text-black/60">{count}/{total}</span>
        </div>
        {children && <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:justify-end">{children}</div>}
      </div>
    </div>
  );
}

export function AdminToolbarSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-full border border-black/10 bg-[#f7f5f1] px-3 text-xs font-black text-black/55 sm:min-w-44">
      <span className="shrink-0">{label}</span>
      <select name={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-black text-black outline-none focus-visible:ring-2 focus-visible:ring-black/15">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function AdminFormDialog({
  open,
  title,
  description,
  message,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  message?: string | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    document.querySelector<HTMLButtonElement>('[aria-modal="true"] button')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto overscroll-contain bg-black/35 px-3 py-6" role="presentation">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.25)]" role="dialog" aria-modal="true" aria-labelledby="admin-crm-dialog-title">
        <div className="flex items-start justify-between gap-3 border-b border-black/10 bg-[#f7f5f1] px-4 py-3">
          <div>
            <h2 id="admin-crm-dialog-title" className="text-lg font-black">{title}</h2>
            {description && <p className="mt-1 text-sm font-bold leading-6 text-black/55">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e6e1d8] hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25" aria-label="סגירה">
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <div className="max-h-[calc(92vh-5rem)] overflow-y-auto overscroll-contain p-4 sm:p-5">
          {children}
          {message && <p className="mt-3 rounded-xl border border-black/10 bg-[#e6e1d8] p-3 text-sm font-black" aria-live="polite">{message}</p>}
        </div>
      </section>
    </div>
  );
}

export function AdminEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
      <p className="text-base font-black">{title}</p>
      <p className="mt-1 text-sm font-bold text-black/45">{description}</p>
    </div>
  );
}

export function AdminActionButtons({
  onEdit,
  onToggle,
  active,
  viewHref,
}: {
  onEdit: () => void;
  onToggle: () => void;
  active: boolean;
  viewHref?: string;
}) {
  function confirmToggle() {
    const message = active
      ? 'להשבית את הפריט? הוא לא יוצג כפעיל, אבל ההיסטוריה הקיימת תישמר.'
      : 'להפעיל את הפריט? הוא יחזור להיות זמין במערכת.';

    if (window.confirm(message)) {
      onToggle();
    }
  }

  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      {viewHref && (
        <Link href={viewHref} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-white px-3 text-xs font-black ring-1 ring-black/10 hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25 sm:flex-none">
          <Eye aria-hidden="true" size={14} />
          צפה
        </Link>
      )}
      <button type="button" onClick={onEdit} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#e6e1d8] px-3 text-xs font-black hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25 sm:flex-none">
        <Edit3 aria-hidden="true" size={14} />
        עריכה
      </button>
      <button type="button" onClick={confirmToggle} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#e6e1d8] px-3 text-xs font-black hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25 sm:flex-none">
        <Power aria-hidden="true" size={14} />
        {active ? 'השבתה' : 'הפעלה'}
      </button>
    </div>
  );
}

export function AdminStatusBadge({ active }: { active: boolean }) {
  return <span className={`w-fit rounded-full px-2 py-1 text-xs font-black ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-black/10 text-black/45'}`}>{active ? 'פעיל' : 'לא פעיל'}</span>;
}

function StatusFilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-black focus-visible:ring-2 focus-visible:ring-black/25 ${active ? 'bg-black text-white' : 'bg-[#e6e1d8] text-black hover:bg-black hover:text-white'}`}>
      {label}
    </button>
  );
}
