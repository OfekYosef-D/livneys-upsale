'use client';

import { CheckCircle, PackageCheck, Truck, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useServerAction } from '@/components/hooks/useServerAction';
import { Button } from '@/components/ui/Button';
import { ActionFeedback } from '@/components/ui/Notice';
import { updateOrderStatusAction } from '../../admin-crm/actions/orders';
import { getAllowedOrderStatusTransitions, orderStatusLabels, type OrderStatus } from '../../orders/status';

const actionLabels: Partial<Record<OrderStatus, { label: string; icon: ReactNode }>> = {
  APPROVED: { label: 'אישור ההזמנה', icon: <CheckCircle size={16} /> },
  PACKED: { label: 'סימון כארוזה', icon: <PackageCheck size={16} /> },
  DELIVERED: { label: 'סימון כסופקה', icon: <Truck size={16} /> },
  CANCELLED: { label: 'ביטול ההזמנה', icon: <XCircle size={16} /> },
};

export function AdminOrderStatusActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const action = useServerAction();
  const nextStatuses = getAllowedOrderStatusTransitions(status);

  function change(next: OrderStatus) {
    if (next === 'CANCELLED' && !window.confirm('לבטל את ההזמנה? הלקוח יקבל הודעה על הביטול.')) return;
    action.run(() => updateOrderStatusAction({ orderId, status: next }), { success: `הסטטוס עודכן ל${orderStatusLabels[next]}. הלקוח עודכן.` }, next);
  }

  if (nextStatuses.length === 0) return <ActionFeedback feedback={action.feedback} />;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-black/55">השלב הבא</p>
      {nextStatuses.map((next) => (
        <Button
          key={next}
          fullWidth
          variant={next === 'CANCELLED' ? 'danger' : 'primary'}
          onClick={() => change(next)}
          pending={action.isPending(next)}
          disabled={action.pending}
          icon={actionLabels[next]?.icon}
        >
          {actionLabels[next]?.label ?? orderStatusLabels[next]}
        </Button>
      ))}
      <ActionFeedback feedback={action.feedback} />
    </div>
  );
}
