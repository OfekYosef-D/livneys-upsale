'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useServerAction } from '@/components/hooks/useServerAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ActionFeedback } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { formatDateTime } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import type { AdditionRequestView } from '../../customer-portal/types';
import { OrderFinancialSummary } from '../../orders/components/OrderFinancialSummary';
import { reviewOrderAdditionAction } from '../actions';
import { getAdditionRequestPresentation } from '../view-model';

export function AdminAdditionRequests({ requests }: { requests: AdditionRequestView[] }) {
  if (requests.length === 0) return null;
  return (
    <Panel>
      <h2 className="border-b border-[var(--pantry-line)] px-4 py-3 text-sm font-semibold">בקשות תוספת</h2>
      <div className="divide-y divide-[var(--pantry-line)]">
        {requests.map((request) => <AdditionRequestCard key={request.id} request={request} />)}
      </div>
    </Panel>
  );
}

function AdditionRequestCard({ request }: { request: AdditionRequestView }) {
  const action = useServerAction();
  const [reason, setReason] = useState('');
  const presentation = getAdditionRequestPresentation(request.status);

  const decide = (decision: 'APPROVED' | 'REJECTED') =>
    action.run(
      () => reviewOrderAdditionAction({ requestId: request.id, decision, reason }),
      { success: decision === 'APPROVED' ? 'הפריטים נוספו להזמנה והלקוח עודכן.' : 'הבקשה נדחתה והלקוח עודכן.' },
      decision,
    );

  return (
    <article className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={presentation.tone}>{presentation.label}</Badge>
          <span className="text-xs text-black/60">נשלחה {formatDateTime(request.submittedAt)}</span>
        </div>
        <ul className="mt-3 divide-y divide-[var(--pantry-line)] text-sm">
          {request.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-3 py-2">
              <span>{line.productName} <span className="text-xs text-black/60">× {line.quantity}</span></span>
              <span className="tabular-nums">{formatMoney(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {request.rejectionReason && <p className="mt-2 text-sm text-red-800">סיבת דחייה: {request.rejectionReason}</p>}
        {request.reviewedAt && (
          <p className="mt-2 text-xs text-black/60">טופלה {formatDateTime(request.reviewedAt)}{request.reviewedByName ? ` על ידי ${request.reviewedByName}` : ''}</p>
        )}
      </div>

      <div className="space-y-3">
        <OrderFinancialSummary totals={request} />
        {request.status === 'PENDING' && (
          <>
            <Button fullWidth onClick={() => decide('APPROVED')} pending={action.isPending('APPROVED')} disabled={action.pending} icon={<Check size={16} />}>
              אישור והוספה להזמנה
            </Button>
            <label className="block">
              <span className="ui-label">סיבת דחייה (תישלח ללקוח)</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="ui-field min-h-16 resize-y py-2" />
            </label>
            <Button fullWidth variant="danger" onClick={() => decide('REJECTED')} pending={action.isPending('REJECTED')} disabled={action.pending || !reason.trim()} icon={<X size={16} />}>
              דחיית הבקשה
            </Button>
          </>
        )}
        <ActionFeedback feedback={action.feedback} />
      </div>
    </article>
  );
}
