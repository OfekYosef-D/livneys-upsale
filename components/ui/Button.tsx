import type React from 'react';
import Link from 'next/link';
export function Button({
  children,
  href,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled = false,
}: {
  children: React.ReactNode;
  href?: string;
  variant?: 'primary' | 'dark' | 'ghost';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const cls = `inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold transition focus-visible:ring-2 focus-visible:ring-black/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
    variant === 'primary'
      ? 'bg-black text-white shadow-[0_16px_34px_rgba(0,0,0,0.18)] hover:bg-black/90'
      : variant === 'dark'
        ? 'bg-white text-black ring-1 ring-black/12 hover:bg-[#e6e1d8]'
        : 'bg-[#e6e1d8] text-black hover:bg-black hover:text-white'
  } ${className}`;

  return href ? (
    <Link className={cls} href={href}>
      {children}
    </Link>
  ) : (
    <button type={type} className={cls} disabled={disabled}>
      {children}
    </button>
  );
}
