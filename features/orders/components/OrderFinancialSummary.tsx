import { money } from '@/lib/format';

export function OrderFinancialSummary({
  subtotal,
  productDiscountTotal,
  paymentDiscountPercent,
  paymentDiscountTotal,
  totalBeforeVat,
  vatRatePercent,
  vatTotal,
  totalIncludingVat,
}: {
  subtotal: number;
  productDiscountTotal: number;
  paymentDiscountPercent: number;
  paymentDiscountTotal: number;
  totalBeforeVat: number;
  vatRatePercent: number;
  vatTotal: number;
  totalIncludingVat: number;
}) {
  return (
    <section aria-label="פירוט סכומי ההזמנה" className="mt-3 border-t border-black/10 pt-3 text-sm font-bold">
      <div className="space-y-1.5">
        <FinancialRow label="סכום ביניים" value={money(subtotal)} />
        {productDiscountTotal > 0 && (
          <FinancialRow label="מבצעים והנחות מוצר" value={`-${money(productDiscountTotal)}`} discount />
        )}
        {paymentDiscountTotal > 0 && (
          <FinancialRow
            label={`הנחת תשלום מיידי (${paymentDiscountPercent}%)`}
            value={`-${money(paymentDiscountTotal)}`}
            discount
          />
        )}
        <FinancialRow label="סה״כ לפני מע״מ" value={money(totalBeforeVat)} strong />
        <FinancialRow label={`מע״מ (${vatRatePercent}%)`} value={money(vatTotal)} />
      </div>

      <div className="mt-3 rounded-xl bg-black px-3 py-3 text-white shadow-sm">
        <p className="text-[11px] font-bold text-white/65">הסכום הכולל לתשלום</p>
        <div className="mt-0.5 flex items-end justify-between gap-3">
          <span className="text-sm font-black">סה״כ כולל מע״מ</span>
          <span className="text-xl font-black tabular-nums md:text-2xl">{money(totalIncludingVat)}</span>
        </div>
      </div>
    </section>
  );
}

function FinancialRow({
  label,
  value,
  discount = false,
  strong = false,
}: {
  label: string;
  value: string;
  discount?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${discount ? 'text-emerald-700' : ''} ${strong ? 'pt-1 font-black' : ''}`}>
      <span>{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}
