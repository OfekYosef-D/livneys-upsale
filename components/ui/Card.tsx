import type React from 'react';
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-black/10 bg-white shadow-[0_18px_60px_rgba(0,0,0,0.06)] ${className}`}>{children}</div>;
}
