'use client';

import Link from 'next/link';
import { Archive, Check, Copy, MessageCircle, PhoneCall, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useServerAction } from '@/components/hooks/useServerAction';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClassName } from '@/components/ui/Button';
import { formValue, SelectField } from '@/components/ui/Field';
import { ActionFeedback, EmptyState } from '@/components/ui/Notice';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { formatDateTime } from '@/lib/datetime';
import { paths } from '@/lib/paths';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';
import { convertRegistrationToCustomerAction, updateRegistrationStatusAction } from '../actions';
import type { getRegistrationManagementData } from '../queries';
import { buildLoginInviteMessage, buildRegistrationInviteMessage, getLoginUrl, getRegistrationUrl } from '../share-links';

type Data = Awaited<ReturnType<typeof getRegistrationManagementData>>;
type Request = Data['requests'][number];

const statusLabels: Record<Request['status'], { label: string; tone: 'warning' | 'info' | 'success' | 'muted' }> = {
  PENDING: { label: 'חדשה', tone: 'warning' },
  CONTACTED: { label: 'נוצר קשר', tone: 'info' },
  CONVERTED: { label: 'נפתח לקוח', tone: 'success' },
  ARCHIVED: { label: 'בארכיון', tone: 'muted' },
};

export function AdminRegistrationsClient({ data, appOrigin }: { data: Data; appOrigin: string }) {
  const action = useServerAction();
  const [filter, setFilter] = useState<'open' | Request['status']>('open');
  const visible = data.requests.filter((request) => (filter === 'open' ? request.status === 'PENDING' || request.status === 'CONTACTED' : request.status === filter));

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="קישורים לשיתוף" description="שלחו ללקוחות פוטנציאליים קישור להרשמה, או ללקוחות קיימים קישור כניסה." />
        <div className="divide-y divide-[var(--pantry-line)]">
          <ShareRow title="הרשמה" url={getRegistrationUrl(appOrigin)} message={buildRegistrationInviteMessage(appOrigin)} />
          <ShareRow title="כניסה" url={getLoginUrl(appOrigin)} message={buildLoginInviteMessage(appOrigin)} />
        </div>
      </Panel>

      <ActionFeedback feedback={action.feedback} />

      <Panel>
        <PanelHeader
          title="בקשות הצטרפות"
          actions={(
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="סינון בקשות" className="ui-field min-h-9 w-auto">
              <option value="open">פתוחות</option>
              <option value="CONVERTED">נפתח לקוח</option>
              <option value="ARCHIVED">ארכיון</option>
            </select>
          )}
        />
        {visible.length === 0 ? (
          <EmptyState title="אין בקשות" description="בקשות חדשות מהטופס באתר יופיעו כאן." />
        ) : (
          <div className="divide-y divide-[var(--pantry-line)]">
            {visible.map((request) => <RequestCard key={request.id} request={request} data={data} action={action} />)}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RequestCard({ request, data, action }: { request: Request; data: Data; action: ReturnType<typeof useServerAction> }) {
  const status = statusLabels[request.status];
  const setStatus = (next: 'CONTACTED' | 'ARCHIVED') =>
    action.run(() => updateRegistrationStatusAction({ id: request.id, status: next }), { success: next === 'ARCHIVED' ? 'הבקשה הועברה לארכיון.' : 'סומן שנוצר קשר.' }, `${request.id}:${next}`);

  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none gap-1 px-4 py-3 hover:bg-[var(--pantry-soft)] md:grid-cols-[1fr_10rem_7rem]">
        <span>
          <span className="block font-medium">{request.businessName}</span>
          <span className="text-xs text-black/55">{request.contactName} · <span dir="ltr">{request.phone}</span> · {request.email}</span>
        </span>
        <span className="text-xs text-black/55">{request.businessType} · {formatDateTime(request.createdAt)}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </summary>
      <div className="space-y-3 border-t border-[var(--pantry-line)] bg-[var(--pantry-soft)] px-4 py-4 text-sm">
        <dl className="grid gap-2 text-xs md:grid-cols-2">
          <Info label="כתובת" value={request.address} />
          <Info label="שם לחשבונית" value={request.invoiceName ?? request.businessName} />
          <Info label="הנהלת חשבונות" value={[request.accountingContactName, request.accountingEmail, request.accountingPhone].filter(Boolean).join(' · ') || '—'} />
          {request.deliveryNotes && <Info label="אילוצי חלוקה" value={request.deliveryNotes} />}
          {request.openingOrderNotes && <Info label="להזמנה ראשונה" value={request.openingOrderNotes} />}
        </dl>

        <div className="flex flex-wrap gap-2">
          <a href={`tel:${request.phone}`} className={buttonClassName({ variant: 'outline', size: 'sm' })}><PhoneCall size={13} /> חיוג</a>
          <a href={buildWhatsAppUrl(request.phone, `שלום ${request.contactName}, כאן ליבני'ס – קיבלנו את בקשת ההצטרפות של ${request.businessName}.`)} target="_blank" rel="noreferrer" className={buttonClassName({ variant: 'outline', size: 'sm' })}>
            <MessageCircle size={13} /> וואטסאפ
          </a>
          {request.convertedCustomerId ? (
            <Link href={paths.admin.customer(request.convertedCustomerId)} className={buttonClassName({ size: 'sm' })}>לכרטיס הלקוח</Link>
          ) : (
            <>
              {request.status === 'PENDING' && <Button size="sm" variant="secondary" icon={<PhoneCall size={13} />} pending={action.isPending(`${request.id}:CONTACTED`)} onClick={() => setStatus('CONTACTED')}>סימון: נוצר קשר</Button>}
              <Button size="sm" variant="ghost" icon={<Archive size={13} />} pending={action.isPending(`${request.id}:ARCHIVED`)} onClick={() => setStatus('ARCHIVED')}>לארכיון</Button>
            </>
          )}
        </div>

        {!request.convertedCustomerId && (
          <form
            className="grid gap-2 rounded-md border border-[var(--pantry-line)] bg-white p-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action.run(
                () => convertRegistrationToCustomerAction({ requestId: request.id, routeId: formValue.text(form, 'routeId'), priceListId: formValue.text(form, 'priceListId') }),
                { success: `נפתח לקוח והקישור להגדרת סיסמה נשלח ל-${request.email}.` },
                `${request.id}:convert`,
              );
            }}
          >
            <SelectField name="routeId" label="קו חלוקה" options={data.routes.map((route) => ({ value: route.id, label: route.name }))} />
            <SelectField name="priceListId" label="מחירון" defaultValue={data.priceLists.find((list) => list.isDefault)?.id} options={data.priceLists.map((list) => ({ value: list.id, label: list.name }))} />
            <Button type="submit" icon={<UserPlus size={15} />} pending={action.isPending(`${request.id}:convert`)} disabled={data.routes.length === 0}>פתיחת לקוח</Button>
          </form>
        )}
      </div>
    </details>
  );
}

function ShareRow({ title, url, message }: { title: string; url: string; message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <span className="w-14 text-xs font-semibold">{title}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-black/55" dir="ltr">{url}</span>
      <Button
        size="sm"
        variant="outline"
        icon={copied ? <Check size={13} /> : <Copy size={13} />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          } catch {
            window.prompt('העתיקו את הקישור:', url);
          }
        }}
      >
        {copied ? 'הועתק' : 'העתקה'}
      </Button>
      <a href={buildWhatsAppUrl(null, message)} target="_blank" rel="noreferrer" className={buttonClassName({ variant: 'outline', size: 'sm' })}>
        <MessageCircle size={13} /> שליחה בוואטסאפ
      </a>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-black/45">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
