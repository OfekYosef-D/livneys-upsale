import type React from 'react';

/**
 * Admin list table. On wide screens it is a regular table (scrolling sideways if needed); on
 * phones each row stacks into a card – give every cell after the first a `label` (or
 * `actions`) so its value stays identifiable.
 */
export function DataTable({
  children,
  minWidth = '40rem',
  className = '',
}: {
  children: React.ReactNode;
  minWidth?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="ui-table-stack w-full border-collapse text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`sticky top-0 z-10 whitespace-nowrap bg-[var(--pantry-soft)] px-3 py-1.5 text-right text-[11px] font-medium text-black/60 ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = '',
  label,
  actions = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Column name shown beside the value when the row is stacked on a phone. */
  label?: string;
  /** Row actions: aligned to the end of the stacked card. */
  actions?: boolean;
}) {
  return (
    <td
      className={`border-t border-[var(--pantry-line)] px-3 py-2 align-middle ${className}`}
      data-label={label}
      data-actions={actions || undefined}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  className = '',
  selected = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      className={`${onClick ? 'cursor-pointer' : ''} ${selected ? 'bg-[var(--pantry)]' : 'hover:bg-[var(--pantry-soft)]'} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}
