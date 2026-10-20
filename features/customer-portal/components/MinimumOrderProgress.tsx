import { formatMoney } from '@/lib/money';
import { MINIMUM_INSTITUTIONAL_ORDER_TOTAL, getMissingForMinimum } from '../../orders/business-rules';

/** Shows how far the cart is from the institutional minimum, so customers are never surprised at checkout. */
export function MinimumOrderProgress({ totalBeforeVat }: { totalBeforeVat: number }) {
  const missing = getMissingForMinimum(totalBeforeVat);
  const progress = Math.min(100, Math.round((totalBeforeVat / MINIMUM_INSTITUTIONAL_ORDER_TOTAL) * 100));

  return (
    <div className="min-w-0">
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--pantry)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="התקדמות למינימום הזמנה">
        <div className={`h-full rounded-full transition-all ${missing > 0 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${progress}%` }} />
      </div>
      <p className={`mt-1 text-[11px] font-medium ${missing > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
        {missing > 0
          ? `חסרים ${formatMoney(missing)} למינימום הזמנה (${formatMoney(MINIMUM_INSTITUTIONAL_ORDER_TOTAL)} לפני מע״מ)`
          : 'עברתם את מינימום ההזמנה'}
      </p>
    </div>
  );
}
