import { formatMoney } from '@/lib/money';
import type { OrderTotals } from '../totals';

/** The same breakdown everywhere money is shown: subtotal → promotions → payment discount → VAT. */
export function OrderFinancialSummary({ totals, className = '' }: { totals: OrderTotals; className?: string }) {
  return (
    <section aria-label="פירוט סכומי ההזמנה" className={`border-t border-[var(--pantry-line)] pt-3 text-sm ${className}`}>
      <dl className="space-y-1.5">
        <Row label="סכום ביניים" value={formatMoney(totals.subtotal)} />
        {totals.discountTotal > 0 && <Row label="מבצעים והנחות" value={`-${formatMoney(totals.discountTotal)}`} discount />}
        {totals.paymentDiscountTotal > 0 && (
          <Row label={`הנחת תשלום מיידי (${totals.paymentDiscountPercent}%)`} value={`-${formatMoney(totals.paymentDiscountTotal)}`} discount />
        )}
        <Row label="סה״כ לפני מע״מ" value={formatMoney(totals.total)} strong />
        <Row label={`מע״מ (${totals.vatRatePercent}%)`} value={formatMoney(totals.vatTotal)} />
      </dl>
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--pantry-line)] pt-3">
        <span className="text-sm font-semibold">סה״כ לתשלום כולל מע״מ</span>
        <span className="text-lg font-semibold tabular-nums">{formatMoney(totals.totalIncludingVat)}</span>
      </div>
    </section>
  );
}

function Row({ label, value, discount = false, strong = false }: { label: string; value: string; discount?: boolean; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${discount ? 'text-emerald-700' : ''} ${strong ? 'pt-1 font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}
