'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatMoney } from '@/lib/money';

/** Number cell that saves on blur / Enter, only when the value actually changed. */
export function InlineNumberField({
  label,
  value,
  min,
  step,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  step: number;
  disabled?: boolean;
  onCommit: (next: number) => void;
}) {
  return (
    <input
      type="number"
      aria-label={label}
      defaultValue={value}
      min={min}
      step={step}
      disabled={disabled}
      className="ui-field h-9 min-h-9 w-24 px-2 tabular-nums"
      onBlur={(event) => {
        const next = Number(event.currentTarget.value);
        if (Number.isFinite(next) && next >= min && next !== value) onCommit(next);
        else event.currentTarget.value = String(value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

/** Sets one price for every active product in a category (base price and all price lists). */
export function CategoryBulkPriceBar({
  categories,
  countActive,
  pending,
  onApply,
}: {
  categories: string[];
  countActive: (category: string) => number;
  pending: boolean;
  onApply: (input: { category: string; price: number }) => void;
}) {
  const [category, setCategory] = useState(categories[0] ?? '');
  const [price, setPrice] = useState('');
  if (categories.length === 0) return null;
  const count = countActive(category);

  return (
    <details className="border-b border-[var(--pantry-line)] bg-[var(--pantry-soft)] px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-black/70">עדכון מחיר לקטגוריה שלמה</summary>
      <form
        className="mt-2 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = Number(price);
          if (!category || !Number.isFinite(next) || next <= 0 || count === 0) return;
          if (!window.confirm(`לעדכן את המחיר של ${count} מוצרים בקטגוריה "${category}" ל-${formatMoney(next)}?\nהמחיר יעודכן בכל המחירונים. הזמנות קיימות לא ישתנו.`)) return;
          onApply({ category, price: next });
        }}
      >
        <label className="block">
          <span className="ui-label">קטגוריה</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="ui-field bg-white">
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="block w-32">
          <span className="ui-label">מחיר חדש (₪)</span>
          <input type="number" min={0.01} step={0.01} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} className="ui-field bg-white" />
        </label>
        <Button type="submit" disabled={count === 0 || !price} pending={pending}>החלה על {count} מוצרים</Button>
      </form>
    </details>
  );
}
