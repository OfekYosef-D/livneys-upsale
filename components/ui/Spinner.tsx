import type React from 'react';

export function Spinner({
  size = 16,
  className = '',
  label,
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`ui-spinner ${className}`}
      style={{ width: size, height: size }}
      {...(label ? { role: 'status' as const, 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
