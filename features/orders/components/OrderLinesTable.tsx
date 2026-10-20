import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/money';
import type { OrderLineView } from '../view-model';

/** Read-only order lines (admin and customer views share it). */
export function OrderLinesTable({ lines }: { lines: OrderLineView[] }) {
  return (
    <DataTable minWidth="30rem">
      <thead>
        <tr>
          <Th>מוצר</Th>
          <Th>כמות</Th>
          <Th>מחיר ליחידה</Th>
          <Th>סה״כ</Th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id}>
            <Td>
              <p className="font-medium">{line.productName}</p>
              {line.promotionLabel && <Badge tone="inverse" className="mt-1">{line.promotionLabel}</Badge>}
            </Td>
            <Td className="tabular-nums">{line.quantity}</Td>
            <Td className="tabular-nums">
              {line.listUnitPrice > line.unitPrice && <span className="block text-xs text-black/40 line-through">{formatMoney(line.listUnitPrice)}</span>}
              {formatMoney(line.unitPrice)}
            </Td>
            <Td className="tabular-nums font-medium">
              {formatMoney(line.lineTotal)}
              {line.discountTotal > 0 && <span className="block text-[11px] font-normal text-emerald-700">חיסכון {formatMoney(line.discountTotal)}</span>}
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
