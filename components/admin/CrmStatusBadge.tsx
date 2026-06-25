import { type CrmOrderStatus, statusLabels } from '@/lib/crm-utils';

const classes: Record<CrmOrderStatus, string> = {
  new: 'bg-white text-black ring-1 ring-black/15',
  needs_review: 'bg-black text-white',
  approved: 'bg-[#e6e1d8] text-black',
  packed: 'bg-white text-black ring-1 ring-black/15',
  completed: 'bg-black/10 text-black/55',
};

export function CrmStatusBadge({ status }: { status: CrmOrderStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${classes[status]}`}>{statusLabels[status]}</span>;
}
