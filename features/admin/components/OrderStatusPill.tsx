import type { OrderStatus } from '@/features/orders/utils';
import { orderStatusLabels } from '@/features/orders/utils';

const classes: Record<OrderStatus, string> = {
  DRAFT: 'bg-black/5 text-black/45',
  SUBMITTED: 'bg-[#e6e1d8] text-black',
  SPECIAL_REQUEST: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-emerald-100 text-emerald-900',
  PACKED: 'bg-blue-100 text-blue-900',
  DELIVERED: 'bg-black text-white',
  CANCELLED: 'bg-red-100 text-red-900',
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${classes[status]}`}>
      {orderStatusLabels[status]}
    </span>
  );
}
