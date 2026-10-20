import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { orderStatusLabels, type OrderStatus } from '../status';

const tones: Record<OrderStatus, BadgeTone> = {
  DRAFT: 'muted',
  SUBMITTED: 'neutral',
  SPECIAL_REQUEST: 'warning',
  APPROVED: 'success',
  PACKED: 'info',
  DELIVERED: 'inverse',
  CANCELLED: 'danger',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={tones[status]}>{orderStatusLabels[status]}</Badge>;
}
