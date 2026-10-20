import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

const variants = {
  primary: 'bg-black text-white hover:bg-black/85 disabled:bg-black/30',
  secondary: 'bg-[var(--pantry)] text-black hover:bg-black hover:text-white disabled:opacity-45',
  outline: 'bg-white text-black ring-1 ring-black/12 hover:bg-[var(--pantry)] disabled:opacity-45',
  ghost: 'text-black/70 hover:bg-[var(--pantry)] hover:text-black disabled:opacity-45',
  danger: 'bg-red-50 text-red-800 hover:bg-red-100 disabled:opacity-45',
} as const;

const sizes = {
  sm: 'min-h-8 px-2.5 text-xs',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-11 px-5 text-sm',
} as const;

export type ButtonVariant = keyof typeof variants;

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: keyof typeof sizes;
  /** Shows a spinner, disables the button and announces the busy state. */
  pending?: boolean;
  pendingLabel?: ReactNode;
  icon?: ReactNode;
  href?: string;
  fullWidth?: boolean;
};

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
}: { variant?: ButtonVariant; size?: keyof typeof sizes; fullWidth?: boolean; className?: string } = {}) {
  return [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold transition',
    'focus-visible:ring-2 focus-visible:ring-black/25 disabled:cursor-not-allowed aria-busy:cursor-wait',
    variants[variant],
    sizes[size],
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ');
}

export function Button({
  children,
  variant,
  size,
  pending = false,
  pendingLabel,
  icon,
  href,
  fullWidth,
  className,
  type = 'button',
  disabled,
  ...props
}: ButtonProps) {
  const classes = buttonClassName({ variant, size, fullWidth, className });

  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button {...props} type={type} disabled={disabled || pending} aria-busy={pending || undefined} className={classes}>
      {pending ? <Spinner size={size === 'sm' ? 13 : 16} /> : icon}
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </button>
  );
}
