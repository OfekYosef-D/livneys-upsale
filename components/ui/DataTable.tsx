import type React from 'react';

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
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`sticky top-0 z-10 whitespace-nowrap bg-[var(--pantry-soft)] px-3 py-1.5 text-right text-[11px] font-medium text-black/50 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-t border-[var(--pantry-line)] px-3 py-2 align-middle ${className}`}>{children}</td>;
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
