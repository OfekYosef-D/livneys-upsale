'use client';

import { useRouter } from 'next/navigation';
import type React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { CheckCircle, PackageCheck, Truck, XCircle } from 'lucide-react';
import { updateOrderStatusAction } from '@/features/admin-crm/actions';
import {
  getAllowedOrderStatusTransitions,
  orderStatusLabels,
  type OrderStatus,
} from '@/features/orders/utils';

const icons: Partial<Record<OrderStatus, React.ReactNode>> = {
  APPROVED: <CheckCircle size={16} />,
  PACKED: <PackageCheck size={16} />,
  DELIVERED: <Truck size={16} />,
  CANCELLED: <XCircle size={16} />,
};

export function AdminOrderStatusActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const nextStatuses = useMemo(() => getAllowedOrderStatusTransitions(status), [status]);

  function updateStatus(nextStatus: OrderStatus) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId, status: nextStatus });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMessage(`הסטטוס עודכן ל${orderStatusLabels[result.data.status]}.`);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-black/10 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black text-black/45">עדכון סטטוס</p>
        {nextStatuses.length === 0 && <span className="text-xs font-black text-black/35">אין פעולות נוספות</span>}
      </div>
      {nextStatuses.length > 0 && (
        <div className="mt-2 grid gap-2">
          {nextStatuses.map((nextStatus) => (
            <button
              key={nextStatus}
              type="button"
              disabled={pending}
              onClick={() => updateStatus(nextStatus)}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-black transition focus-visible:ring-2 focus-visible:ring-black/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${
                nextStatus === 'CANCELLED'
                  ? 'bg-red-50 text-red-800 hover:bg-red-100'
                  : 'bg-black text-white hover:bg-black/90'
              }`}
            >
              {icons[nextStatus]}
              {pending ? 'מעדכן...' : orderStatusLabels[nextStatus]}
            </button>
          ))}
        </div>
      )}
      {message && <p className="mt-2 text-xs font-bold text-black/55">{message}</p>}
    </div>
  );
}
