'use client';

import { BellRing, Mail, MessageCircle, Plus, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useServerAction } from '@/components/hooks/useServerAction';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CheckboxField, formValue, SelectField, TextField } from '@/components/ui/Field';
import { ActionFeedback, EmptyState, Notice } from '@/components/ui/Notice';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Toolbar } from '@/components/ui/Toolbar';
import { formatDateTime } from '@/lib/datetime';
import { formatOrderNumber } from '../../orders/status';
import { createReminderRuleAction, sendNotificationJobNowAction, updateReminderRuleAction } from '../actions';
import { compareJobsForOperator, notificationChannelLabels, notificationStatusLabels, notificationTemplateLabels } from '../labels';
import type { NotificationManagementData } from '../queries';

type Job = NotificationManagementData['jobs'][number];
type Rule = NotificationManagementData['reminderRules'][number];

const statusTone = { FAILED: 'danger', SENT: 'success', DRY_RUN: 'warning', PENDING: 'neutral', PROCESSING: 'info', CANCELLED: 'muted' } as const;

export function AdminNotificationsClient({ data, initialSearch }: { data: NotificationManagementData; initialSearch: string }) {
  return (
    <div className="space-y-4">
      <ChannelStatus channels={data.channels} />
      <ReminderRules rules={data.reminderRules} routes={data.routes} whatsappEnabled={data.channels.whatsapp.enabled} />
      <JobQueue jobs={data.jobs} initialSearch={initialSearch} />
      {data.channels.whatsapp.enabled && data.webhookEvents.length > 0 && (
        <details className="ui-panel">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">אירועי WhatsApp אחרונים (אבחון טכני)</summary>
          <ul className="divide-y divide-[var(--pantry-line)] border-t border-[var(--pantry-line)] text-xs">
            {data.webhookEvents.map((event) => (
              <li key={event.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span>{event.kind}{event.providerStatus ? ` · ${event.providerStatus}` : ''} · {event.customerName ?? 'לא משויך'}</span>
                <span className="text-black/60">{formatDateTime(event.receivedAt)}</span>
                {event.errorMessage && <span className="w-full text-red-700">{event.errorMessage}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ChannelStatus({ channels }: { channels: NotificationManagementData['channels'] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Notice tone={channels.email.configured ? 'success' : 'danger'} icon={<Mail size={16} />} title={channels.email.configured ? 'אימייל פעיל' : 'אימייל לא מוגדר'}>
        {channels.email.configured
          ? `אישורי הזמנה, עדכוני סטטוס ותזכורות נשלחים מ-${channels.email.from}.`
          : 'יש להגדיר RESEND_API_KEY ו-EMAIL_FROM. עד אז הודעות נשמרות במצב בדיקה ולא נשלחות.'}
      </Notice>
      <Notice tone={channels.whatsapp.enabled ? 'success' : 'neutral'} icon={<MessageCircle size={16} />} title={channels.whatsapp.enabled ? 'WhatsApp עסקי פעיל' : 'WhatsApp עסקי עדיין לא מחובר'}>
        {channels.whatsapp.enabled
          ? channels.whatsapp.missingTemplates.length > 0
            ? `חסרות תבניות מאושרות: ${channels.whatsapp.missingTemplates.map((key) => notificationTemplateLabels[key] ?? key).join(', ')}.`
            : 'כל התבניות מוגדרות.'
          : 'הלקוחות מקבלים הכול במייל. אפשר לשלוח תזכורת אישית בוואטסאפ מלוח העבודה בלחיצה.'}
      </Notice>
    </div>
  );
}

function ReminderRules({ rules, routes, whatsappEnabled }: { rules: Rule[]; routes: NotificationManagementData['routes']; whatsappEnabled: boolean }) {
  const action = useServerAction();
  const [creating, setCreating] = useState(rules.length === 0);
  const routeOptions = [{ value: '', label: 'כל הקווים' }, ...routes.map((route) => ({ value: route.id, label: route.name }))];
  const channelOptions = [{ value: 'EMAIL', label: 'אימייל' }, ...(whatsappEnabled ? [{ value: 'WHATSAPP', label: 'WhatsApp' }] : [])];

  const readRule = (form: FormData) => ({
    name: formValue.text(form, 'name'),
    routeId: formValue.text(form, 'routeId'),
    channel: formValue.text(form, 'channel'),
    hoursBeforeDelivery: formValue.text(form, 'hoursBeforeDelivery'),
    isActive: formValue.checkbox(form, 'isActive'),
  });

  return (
    <Panel>
      <PanelHeader
        title={<span className="inline-flex items-center gap-2"><BellRing size={15} aria-hidden="true" /> תזכורות שבועיות להזמנה</span>}
        description="לקוח שעוד לא הזמין לחלוקה הקרובה מקבל תזכורת עם קישור להזמנה חוזרת. מי שכבר הזמין – לא מקבל."
        actions={!creating && <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>תזכורת חדשה</Button>}
      />
      <div className="divide-y divide-[var(--pantry-line)]">
        {creating && (
          <form
            className="grid gap-2 bg-[var(--pantry-soft)] p-4 md:grid-cols-[1fr_10rem_8rem_8rem_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              action.run(() => createReminderRuleAction(readRule(new FormData(event.currentTarget))), { success: 'התזכורת נוצרה.', onSuccess: () => setCreating(false) }, 'create');
            }}
          >
            <TextField name="name" label="שם" defaultValue="תזכורת שבועית" required />
            <SelectField name="routeId" label="קו" options={routeOptions} />
            <SelectField name="channel" label="ערוץ" options={channelOptions} />
            <TextField name="hoursBeforeDelivery" label="שעות לפני החלוקה" type="number" min={1} max={720} defaultValue={48} required />
            <input type="hidden" name="isActive" value="on" />
            <Button type="submit" pending={action.isPending('create')}>שמירה</Button>
          </form>
        )}
        {rules.map((rule) => (
          <form
            key={`${rule.id}:${rule.hoursBeforeDelivery}:${rule.isActive}`}
            className="grid gap-2 p-4 md:grid-cols-[1fr_10rem_8rem_8rem_auto_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              action.run(() => updateReminderRuleAction({ ruleId: rule.id, ...readRule(new FormData(event.currentTarget)) }), { success: 'התזכורת עודכנה.' }, rule.id);
            }}
          >
            <TextField name="name" label="שם" defaultValue={rule.name} required />
            <SelectField name="routeId" label="קו" defaultValue={rule.routeId ?? ''} options={routeOptions} />
            <SelectField name="channel" label="ערוץ" defaultValue={rule.channel} options={channelOptions.some((option) => option.value === rule.channel) ? channelOptions : [...channelOptions, { value: rule.channel, label: notificationChannelLabels[rule.channel] }]} />
            <TextField name="hoursBeforeDelivery" label="שעות לפני החלוקה" type="number" min={1} max={720} defaultValue={rule.hoursBeforeDelivery} required />
            <div className="pb-2"><CheckboxField name="isActive" label="פעילה" defaultChecked={rule.isActive} /></div>
            <Button type="submit" variant="outline" pending={action.isPending(rule.id)}>עדכון</Button>
          </form>
        ))}
        {rules.length === 0 && !creating && <EmptyState title="אין תזכורות פעילות" description="צרו תזכורת כדי שלקוחות יקבלו מייל לפני כל חלוקה." />}
        <ActionFeedback feedback={action.feedback} className="m-4" />
      </div>
    </Panel>
  );
}

function JobQueue({ jobs, initialSearch }: { jobs: Job[]; initialSearch: string }) {
  const action = useServerAction();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<'all' | Job['status']>('all');
  const failed = jobs.filter((job) => job.status === 'FAILED').length;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return jobs
      .filter((job) => (status === 'all' || job.status === status)
        && (!needle || [job.customerName, job.recipient, job.orderId, job.orderNumber, job.errorMessage, notificationTemplateLabels[job.templateKey]]
          .some((value) => value !== null && value !== undefined && String(value).toLowerCase().includes(needle))))
      .sort(compareJobsForOperator);
  }, [jobs, search, status]);

  return (
    <Panel>
      <PanelHeader title="הודעות שנשלחו ללקוחות" description={failed > 0 ? `${failed} הודעות נכשלו – אפשר לנסות לשלוח שוב.` : '150 ההודעות האחרונות.'} />
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי לקוח, מייל, טלפון או הזמנה" aria-label="חיפוש הודעות" className="ui-field min-h-9 max-w-xs flex-1 bg-[var(--pantry-soft)]" />
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="סינון לפי סטטוס" className="ui-field min-h-9 w-auto bg-[var(--pantry-soft)]">
            <option value="all">כל הסטטוסים</option>
            {(['FAILED', 'PENDING', 'SENT', 'DRY_RUN'] as const).map((value) => <option key={value} value={value}>{notificationStatusLabels[value]}</option>)}
          </select>
          <span className="ms-auto text-[11px] tabular-nums text-black/60">{visible.length}/{jobs.length}</span>
        </div>
      </Toolbar>
      <ActionFeedback feedback={action.feedback} className="m-3" />
      {visible.length === 0 ? (
        <EmptyState title="אין הודעות להצגה" />
      ) : (
        <ul className="divide-y divide-[var(--pantry-line)]">
          {visible.map((job) => (
            <li key={job.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {job.customerName}
                  <Badge tone={statusTone[job.status]}>{notificationStatusLabels[job.status]}</Badge>
                  <Badge tone="muted">{notificationChannelLabels[job.channel]}</Badge>
                </p>
                <p className="text-xs text-black/60">
                  {notificationTemplateLabels[job.templateKey] ?? job.templateKey}
                  {job.orderNumber !== null ? ` · ${formatOrderNumber(job.orderNumber)}` : ''}
                  {' · '}{formatDateTime(job.processedAt ?? job.scheduledAt)}
                  {job.recipient ? <> · <span dir="ltr">{job.recipient}</span></> : null}
                </p>
                {job.errorMessage && <p className="mt-1 break-words text-xs text-red-800">{job.errorMessage}</p>}
              </div>
              {['FAILED', 'PENDING', 'DRY_RUN'].includes(job.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Send size={13} />}
                  pending={action.isPending(job.id)}
                  disabled={action.pending}
                  onClick={() => action.run(() => sendNotificationJobNowAction({ jobId: job.id }), {
                    success: (result) => (result.status === 'SENT' ? 'ההודעה נשלחה.' : result.status === 'DRY_RUN' ? 'הערוץ במצב בדיקה – ההודעה לא נשלחה בפועל.' : 'השליחה נכשלה. פרטי השגיאה מופיעים ברשימה.'),
                  }, job.id)}
                >
                  שליחה עכשיו
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
