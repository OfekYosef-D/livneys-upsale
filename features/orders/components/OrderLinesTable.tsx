import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/money';
import type { OrderLineView } from '../view-model';

/**
 * Read-only order lines (admin and customer views share it). A stacked list rather than a
 * table so every figure stays visible on a phone and in the narrow admin quick view.
 */
export function OrderLinesTable({ lines }: { lines: OrderLineView[] }) {
  return (
    <ul className="divide-y divide-[var(--pantry-line)] text-sm">
      {lines.map((line) => (
        <li key={line.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="font-medium">{line.productName}</p>
            <p className="mt-0.5 text-xs tabular-nums text-black/55">
              {line.quantity} ×{' '}
              {line.listUnitPrice > line.unitPrice && <span className="text-black/40 line-through">{formatMoney(line.listUnitPrice)}</span>}{' '}
              {formatMoney(line.unitPrice)}
            </p>
            {line.promotionLabel && <Badge tone="inverse" className="mt-1">{line.promotionLabel}</Badge>}
          </div>
          <div className="shrink-0 text-left tabular-nums">
            <p className="font-medium">{formatMoney(line.lineTotal)}</p>
            {line.discountTotal > 0 && <p className="text-[11px] text-emerald-700">חיסכון {formatMoney(line.discountTotal)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
