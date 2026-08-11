'use client';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react';

export function parseOrderQuantity(draft: string, min: number, step: number): number | null {
  const safeStep = Math.max(1, Math.floor(step));
  const safeMin = Math.max(1, Math.floor(min));

  if (!/^\d+$/.test(draft)) return null;

  const quantity = Number(draft);
  if (!Number.isSafeInteger(quantity)) return null;
  if (quantity === 0) return 0;
  if (quantity < safeMin || quantity % safeStep !== 0) return null;

  return quantity;
}

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
  const safeStep = Math.max(1, Math.floor(step));
  const safeMin = Math.max(1, Math.floor(min));
  const [draft, setDraft] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);
  const parsedDraft = parseOrderQuantity(draft, safeMin, safeStep);
  const draftIsValid = parsedDraft !== null;
  const decrement = Math.max(0, value - safeStep);
  const increment = value === 0 ? Math.max(safeMin, safeStep) : value + safeStep;

  useEffect(() => {
    if (!isEditing) setDraft(String(value));
  }, [isEditing, value]);

  function commitDraft(nextDraft: string) {
    setIsEditing(false);
    const parsedQuantity = parseOrderQuantity(nextDraft, safeMin, safeStep);

    if (parsedQuantity === null) {
      setDraft(String(value));
      return;
    }

    onChange(parsedQuantity);
    setDraft(String(parsedQuantity));
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    setIsEditing(true);
    event.currentTarget.select();
  }

  function handleInput(event: FormEvent<HTMLInputElement>) {
    setDraft(event.currentTarget.value.replace(/\D/g, ''));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key !== 'Escape') return;

    event.preventDefault();
    event.currentTarget.value = String(value);
    setDraft(String(value));
    event.currentTarget.blur();
  }

  return (
    <div className="grid h-10 grid-cols-[2.5rem_1fr_2.5rem] items-center overflow-hidden rounded-full border border-black/10 bg-[#e6e1d8]">
      <button
        type="button"
        aria-label="הפחת כמות"
        onClick={() => onChange(decrement)}
        className="grid h-full place-items-center bg-white text-black transition hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25"
      >
        <Minus size={16} strokeWidth={2.4} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
        dir="ltr"
        aria-label="כמות להזמנה"
        aria-invalid={isEditing && !draftIsValid}
        title={`יש להזין 0 להסרה או כמות של לפחות ${safeMin}, בכפולות של ${safeStep}`}
        value={draft}
        maxLength={6}
        onChange={handleInput}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={(event) => commitDraft(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        className={`h-full min-w-0 w-full appearance-none border-0 px-1 text-center text-base font-black tabular-nums outline-none transition focus:ring-2 focus:ring-inset focus:ring-black/25 ${
          isEditing && !draftIsValid ? 'bg-red-50 text-red-700' : 'bg-[#e6e1d8] text-black'
        }`}
      />
      <button
        type="button"
        aria-label="הוסף כמות"
        onClick={() => onChange(increment)}
        className="grid h-full place-items-center bg-black text-white transition hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-black/25"
      >
        <Plus size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
