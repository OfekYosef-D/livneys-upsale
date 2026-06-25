'use client';
import { Minus, Plus } from 'lucide-react';

export function QuantityStepper({
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  const decrement = Math.max(0, value - step);
  const increment = value === 0 ? Math.max(min, step) : value + step;

  return (
    <div className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center overflow-hidden rounded-full border border-black/10 bg-[#e6e1d8]">
      <button
        aria-label="הפחת כמות"
        onClick={() => onChange(decrement)}
        className="grid h-full place-items-center bg-white text-black transition hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25"
      >
        <Minus size={16} strokeWidth={2.4} />
      </button>
      <span className="min-w-10 text-center text-sm font-black tabular-nums">{value}</span>
      <button
        aria-label="הוסף כמות"
        onClick={() => onChange(increment)}
        className="grid h-full place-items-center bg-black text-white transition hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-black/25"
      >
        <Plus size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
