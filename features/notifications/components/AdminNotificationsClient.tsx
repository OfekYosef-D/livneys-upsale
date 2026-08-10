'use client';

import type React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { sendNotificationJobNowAction, updateReminderRuleAction } from '@/features/notifications/actions';
import { formatOrderNumber } from '@/features/orders/order-number';
import type { getNotificationManagementData } from '@/features/notifications/queries';
import {
  compareJobsForOperator,
  filterNotificationJobsForOperator,
  notificationJobFilterLabels,
  notificationJobStatusLabels,
  notificationTemplateLabels,
  type JobStatusFilter,
} from '@/features/notifications/ui-utils';

type NotificationData = Awaited<ReturnType<typeof getNotificationManagementData>>;
type ReminderRule = NotificationData['reminderRules'][number];
type NotificationJob = NotificationData['jobs'][number];
type WebhookEvent = NotificationData['webhookEvents'][number];

export function AdminNotificationsClient({ data, initialSearch = '' }: { data: NotificationData; initialSearch?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<JobStatusFilter>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pendingCount = data.summary.pending + data.summary.processing;
  const setupIssueCount = [
    !data.config.providerConfigured,
    !data.config.webhookConfigured,
    data.config.missingTemplates.length > 0,
  ].filter(Boolean).length;

  const filteredJobs = useMemo(() => {
    return filterNotificationJobsForOperator(data.jobs, search, status);
  }, [data.jobs, search, status]);

  const attentionJobs = useMemo(
    () => data.jobs.filter((job) => job.status === 'FAILED' || job.status === 'PENDING' || job.status === 'PROCESSING').sort(compareJobsForOperator).slice(0, 4),
    [data.jobs],
  );

  function sendJob(jobId: string) {
    setPendingJobId(jobId);
    setMessage(null);
    startTransition(async () => {
      const result = await sendNotificationJobNowAction({ jobId });
      setPendingJobId(null);
      if (result.ok) {
        router.refresh();
      }
      setMessage(result.ok ? 'ההודעה הועברה לשליחה. הרשימה תתעדכן לפי תוצאת העיבוד.' : result.error);
    });
  }

  return (
    <div dir="rtl" className="space-y-4">
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)] sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,.72fr)] xl:items-start">
          <div className="min-w-0">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${data.config.sendEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {data.config.sendEnabled ? <Radio size={15} /> : <ShieldCheck size={15} />}
              {data.config.sendEnabled ? 'שליחה חיה פעילה' : 'מצב בדיקה פעיל'}
            </div>
            <h2 className="mt-3 text-xl font-black leading-tight sm:text-2xl">תמונת מצב למפעיל</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-black/60">
              {data.config.sendEnabled
                ? 'פעולות אוטומטיות וידניות עשויות לשלוח הודעות WhatsApp אמיתיות ללקוחות. לפני שליחה ידנית, ודאו שהלקוח והטלפון נכונים.'
                : 'המערכת מתעדת ומעבדת הודעות לבדיקה בלבד. לקוחות לא יקבלו הודעות WhatsApp אמיתיות עד להפעלת שליחה חיה.'}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Metric label="ממתינות" value={pendingCount} hint={`${data.summary.processing} בעיבוד עכשיו`} icon={<Clock size={18} />} tone="amber" />
            <Metric label="נכשלו" value={data.summary.failed} hint={data.summary.failed > 0 ? 'דורש בדיקה' : 'אין כשלונות'} icon={<AlertTriangle size={18} />} tone={data.summary.failed > 0 ? 'red' : 'neutral'} />
            <Metric label="נשלחו" value={data.summary.sent} hint="נרשמו כנשלחו" icon={<CheckCircle2 size={18} />} tone="green" />
            <Metric label="בדיקה" value={data.summary.dryRun} hint="לא נשלחו ללקוחות" icon={<ShieldCheck size={18} />} tone="neutral" />
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <OperatorNote
            label="מצב עבודה"
            value={data.config.sendEnabled ? 'שליחה חיה' : 'בדיקה בלבד'}
            tone={data.config.sendEnabled ? 'green' : 'amber'}
          />
          <OperatorNote
            label="הגדרות לבדיקה"
            value={setupIssueCount === 0 ? 'הגדרות תקינות' : `${setupIssueCount} סעיפים דורשים בדיקה`}
            tone={setupIssueCount === 0 ? 'green' : 'amber'}
          />
          <OperatorNote
            label="הודעות מוצגות"
            value={`${data.summary.total} האחרונות`}
            tone="neutral"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <div className="border-b border-black/10 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={17} />
            <h2 className="text-base font-black">מה צריך בדיקה עכשיו</h2>
          </div>
          <p className="mt-1 text-xs font-bold leading-5 text-black/50">הודעות שנכשלו או מחכות לשליחה מופיעות כאן ראשונות.</p>
        </div>
        <div className="divide-y divide-black/10">
          {attentionJobs.length === 0 ? (
            <p className="p-4 text-sm font-bold text-black/45">אין תקלות או הודעות שמחכות לטיפול כרגע.</p>
          ) : (
            attentionJobs.map((job) => (
              <NotificationJobRow
                key={job.id}
                job={job}
                sendEnabled={data.config.sendEnabled}
                isSending={isPending && pendingJobId === job.id}
                onSend={() => sendJob(job.id)}
                compact
              />
            ))
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-2 border-b border-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BellRing size={17} />
              <h2 className="text-base font-black">תזכורות אוטומטיות</h2>
            </div>
            <p className="mt-1 text-xs font-bold leading-5 text-black/50">קובע מתי לשלוח תזכורת ללקוחות שלא הזמינו לפני חלוקה.</p>
          </div>
          <span className="w-fit rounded-full bg-[#e6e1d8] px-3 py-1 text-xs font-black text-black/60">
            {data.reminderRules.filter((rule) => rule.isActive).length}/{data.reminderRules.length} פעילות
          </span>
        </div>
        <div className="divide-y divide-black/10">
          {data.reminderRules.length === 0 ? (
            <p className="p-4 text-sm font-bold text-black/45">אין כרגע חוקי תזכורת WhatsApp.</p>
          ) : (
            data.reminderRules.map((rule) => <ReminderRuleRow key={rule.id} rule={rule} />)
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-3 shadow-[0_14px_42px_rgba(0,0,0,0.04)] sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 text-sm font-black">
            <SlidersHorizontal size={17} />
            <span>סינון הודעות</span>
          </div>
          <label className="relative block w-full xl:max-w-md">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35" size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="חיפוש לפי לקוח, טלפון, הזמנה או תוכן הודעה"
              className="min-h-11 w-full rounded-xl border border-black/10 bg-[#f7f5f1] py-2 pl-3 pr-10 text-sm font-bold outline-none focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </label>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {(['all', 'PENDING', 'PROCESSING', 'DRY_RUN', 'SENT', 'FAILED'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`min-h-10 shrink-0 rounded-full px-3 text-xs font-black transition ${status === item ? 'bg-black text-white' : 'bg-[#e6e1d8] text-black hover:bg-black hover:text-white'}`}
              >
                {notificationJobFilterLabels[item]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {message && <p aria-live="polite" className="rounded-xl border border-black/10 bg-[#e6e1d8] p-3 text-sm font-black">{message}</p>}

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-2 border-b border-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-black">הודעות לשליחה ומעקב</h2>
            <p className="mt-1 text-xs font-bold text-black/50">המידע המרכזי מוצג כאן. מזהים טכניים נמצאים בתוך פרטי האבחון בכל שורה.</p>
          </div>
          <span className="w-fit rounded-full bg-[#e6e1d8] px-3 py-1 text-xs font-black text-black/60">{filteredJobs.length}/{data.jobs.length}</span>
        </div>
        <div className="divide-y divide-black/10">
          {filteredJobs.length === 0 ? (
            <p className="p-4 text-sm font-bold text-black/45">אין הודעות שתואמות לסינון הנוכחי.</p>
          ) : (
            filteredJobs.map((job) => (
              <NotificationJobRow
                key={job.id}
                job={job}
                sendEnabled={data.config.sendEnabled}
                isSending={isPending && pendingJobId === job.id}
                onSend={() => sendJob(job.id)}
              />
            ))
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3 sm:px-5">
          <Settings2 size={17} />
          <h2 className="text-base font-black">אבחון טכני</h2>
        </div>
        <div className="divide-y divide-black/10">
          <details className="group px-4 py-3 sm:px-5">
            <summary className="cursor-pointer list-none text-sm font-black text-black/80">
              הגדרות חיבור ותבניות
              <span className="mr-2 text-xs font-bold text-black/45 group-open:hidden">פתח פרטים</span>
            </summary>
            <div className="mt-3 grid gap-2 text-xs font-black text-black/60 sm:grid-cols-3">
              <ConfigPill active={data.config.providerConfigured} label="Meta credentials" />
              <ConfigPill active={data.config.webhookConfigured} label="Webhook verify token" />
              <ConfigPill active={data.config.missingTemplates.length === 0} label={`${data.config.missingTemplates.length} template keys חסרים`} />
            </div>
            {data.config.missingTemplates.length > 0 && (
              <p className="mt-3 break-words rounded-xl bg-red-50 p-3 text-xs font-black leading-5 text-red-800">
                Template keys חסרים: {data.config.missingTemplates.join(', ')}
              </p>
            )}
          </details>

          <details className="group px-4 py-3 sm:px-5">
            <summary className="cursor-pointer list-none text-sm font-black text-black/80">
              אירועי Webhook אחרונים
              <span className="mr-2 text-xs font-bold text-black/45 group-open:hidden">{data.webhookEvents.length} אירועים</span>
            </summary>
            <WebhookEventsList events={data.webhookEvents} />
          </details>
        </div>
      </section>
    </div>
  );
}

function NotificationJobRow({
  job,
  sendEnabled,
  isSending,
  onSend,
  compact = false,
}: {
  job: NotificationJob;
  sendEnabled: boolean;
  isSending: boolean;
  onSend: () => void;
  compact?: boolean;
}) {
  const canSendManually = job.status === 'PENDING' || job.status === 'FAILED' || job.status === 'DRY_RUN';
  const customerContact = [job.customerContact, job.customerPhone].filter(Boolean).join(' / ');

  return (
    <article className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,.34fr)] lg:items-start">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="break-words text-base font-black leading-6">{job.customerName}</p>
            <p className="mt-1 break-words text-xs font-bold leading-5 text-black/50">{customerContact || 'לא נשמרו פרטי קשר'}</p>
          </div>
          <StatusBadge status={job.status} dryRun={job.dryRun} />
        </div>

        <div className="grid gap-2 rounded-xl bg-[#f7f5f1] p-3 sm:grid-cols-2 xl:grid-cols-3">
          <InfoCell label="סוג הודעה">{notificationTemplateLabels[job.templateKey] ?? job.templateName ?? 'הודעת WhatsApp'}</InfoCell>
          <InfoCell label="תוזמנה">{formatDateTime(job.scheduledAt)}</InfoCell>
          <InfoCell label="עובד">{job.processedAt ? formatDateTime(job.processedAt) : 'טרם עובד'}</InfoCell>
          {job.orderNumber !== null && <InfoCell label="הזמנה">{formatOrderNumber(job.orderNumber)}</InfoCell>}
          {job.nextAttemptAt && <InfoCell label="ניסיון הבא">{formatDateTime(job.nextAttemptAt)}</InfoCell>}
          {job.lastAttemptAt && <InfoCell label="ניסיון אחרון">{formatDateTime(job.lastAttemptAt)}</InfoCell>}
        </div>

        {job.message && <p className="rounded-xl border border-black/10 bg-white p-3 text-xs font-bold leading-5 text-black/60">{job.message}</p>}
        {job.errorMessage && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-black leading-5 text-red-800">{job.errorMessage}</p>
        )}

        {!compact && <details className="rounded-xl border border-black/10 bg-white p-3">
          <summary className="cursor-pointer text-xs font-black text-black/65">פרטים טכניים</summary>
          <dl className="mt-3 grid gap-2 text-xs font-bold text-black/55 sm:grid-cols-2">
            <DiagnosticItem label="status" value={job.status} />
            <DiagnosticItem label="dry-run" value={job.dryRun ? 'true' : 'false'} />
            <DiagnosticItem label="template key" value={job.templateKey} />
            <DiagnosticItem label="template name" value={job.templateName ?? 'לא קיים'} />
            <DiagnosticItem label="provider message id" value={job.providerMessageId ?? 'לא קיים'} />
            <DiagnosticItem label="attempts" value={`${job.attempts}/${job.maxAttempts}`} />
            {job.reminderJobId && <DiagnosticItem label="reminder id" value={job.reminderJobId} />}
            {job.reminderStatus && <DiagnosticItem label="reminder status" value={job.reminderStatus} />}
            {job.orderStatus && <DiagnosticItem label="order status" value={job.orderStatus} />}
          </dl>
        </details>}
      </div>

      {canSendManually && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold leading-5 text-amber-900">
            {sendEnabled
              ? 'שליחה ידנית תנסה לעבד את ההודעה עכשיו ועלולה לשלוח WhatsApp אמיתי ללקוח.'
              : 'במצב בדיקה, שליחה ידנית תרשום ניסיון עיבוד בלי לשלוח WhatsApp אמיתי ללקוח.'}
          </p>
          <button
            type="button"
            onClick={onSend}
            disabled={isSending}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-black px-4 text-xs font-black text-white transition hover:bg-black/90 disabled:opacity-60"
          >
            {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {isSending ? 'שולח...' : 'שלח עכשיו'}
          </button>
        </div>
      )}
    </article>
  );
}

function ReminderRuleRow({ rule }: { rule: ReminderRule }) {
  const router = useRouter();
  const [name, setName] = useState(rule.name);
  const [hoursBeforeDelivery, setHoursBeforeDelivery] = useState(String(rule.hoursBeforeDelivery));
  const [isActive, setIsActive] = useState(rule.isActive);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveRule() {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateReminderRuleAction({
        ruleId: rule.id,
        name,
        hoursBeforeDelivery,
        isActive,
      });

      if (result.ok) {
        setFeedback('נשמר');
        router.refresh();
        return;
      }

      setFeedback(result.error);
    });
  }

  return (
    <div className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(12rem,1fr)_9rem_7rem_7rem] lg:items-end">
      <label className="grid gap-1">
        <span className="text-xs font-black text-black/55">שם התזכורת</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-11 rounded-xl border border-black/10 bg-[#f7f5f1] px-3 text-sm font-bold outline-none focus:border-black focus:ring-2 focus:ring-black/10"
        />
        <span className="text-xs font-bold text-black/45">{rule.routeName ? `${rule.routeName}${rule.routeRegion ? ` / ${rule.routeRegion}` : ''}` : 'כל הקווים'}</span>
      </label>
      <label className="grid gap-1">
        <span className="text-xs font-black text-black/55">שעות לפני חלוקה</span>
        <input
          type="number"
          min={1}
          max={720}
          value={hoursBeforeDelivery}
          onChange={(event) => setHoursBeforeDelivery(event.target.value)}
          className="min-h-11 rounded-xl border border-black/10 bg-[#f7f5f1] px-3 text-sm font-bold tabular-nums outline-none focus:border-black focus:ring-2 focus:ring-black/10"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-black/10 bg-[#f7f5f1] px-3 text-sm font-black text-black/70 lg:border-transparent lg:bg-transparent lg:px-0">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 accent-black"
        />
        פעיל
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
        <button
          type="button"
          onClick={saveRule}
          disabled={isPending}
          className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-full bg-black px-4 text-xs font-black text-white transition hover:bg-black/90 disabled:opacity-60 sm:w-auto"
        >
          <CheckCircle2 size={14} />
          {isPending ? 'שומר...' : 'שמור'}
        </button>
        {feedback && <span aria-live="polite" className="text-xs font-black text-black/55">{feedback}</span>}
      </div>
    </div>
  );
}

function WebhookEventsList({ events }: { events: WebhookEvent[] }) {
  if (events.length === 0) {
    return <p className="mt-3 rounded-xl bg-[#f7f5f1] p-3 text-sm font-bold text-black/45">אין אירועי webhook להצגה.</p>;
  }

  return (
    <div className="mt-3 divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10">
      {events.map((event) => (
        <div key={event.id} className="grid gap-2 p-3 text-xs md:grid-cols-[9rem_minmax(0,1fr)_10rem] md:items-center">
          <p className="font-black text-black/75">{event.kind}{event.providerStatus ? ` / ${event.providerStatus}` : ''}</p>
          <div className="min-w-0 font-bold leading-5 text-black/60">
            <p className="break-words">{event.customerName ?? event.fromPhone ?? 'לא שויך ללקוח'}</p>
            {event.providerMessageId && <p className="break-all text-black/40">provider message id: {event.providerMessageId}</p>}
            {event.errorMessage && <p className="break-words text-red-700">{event.errorMessage}</p>}
          </div>
          <p className="font-black text-black/45">{formatDateTime(event.receivedAt)}</p>
        </div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'amber' | 'green' | 'red';
}) {
  const toneClass = {
    neutral: 'bg-[#f7f5f1] text-black',
    amber: 'bg-amber-50 text-amber-900',
    green: 'bg-emerald-50 text-emerald-900',
    red: 'bg-red-900 text-white',
  }[tone];

  return (
    <div className={`rounded-xl border border-black/10 p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black opacity-70">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-65">{hint}</p>
    </div>
  );
}

function OperatorNote({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'amber' | 'green' }) {
  const toneClass = {
    neutral: 'bg-[#f7f5f1] text-black/70',
    amber: 'bg-amber-50 text-amber-900',
    green: 'bg-emerald-50 text-emerald-900',
  }[tone];

  return (
    <div className={`rounded-xl border border-black/10 px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-black opacity-65">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-black text-black/45">{label}</p>
      <p className="mt-1 break-words text-xs font-black leading-5 text-black/70">{children}</p>
    </div>
  );
}

function DiagnosticItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-[#f7f5f1] px-3 py-2">
      <dt className="font-black text-black/45">{label}</dt>
      <dd className="mt-1 break-all font-bold text-black/65">{value}</dd>
    </div>
  );
}

function ConfigPill({ active, label }: { active: boolean; label: string }) {
  return <span className={`rounded-full px-3 py-2 ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-black/10 text-black/50'}`}>{label}</span>;
}

function StatusBadge({ status, dryRun }: { status: string; dryRun: boolean }) {
  const tone =
    status === 'FAILED'
      ? 'bg-red-100 text-red-800'
      : status === 'SENT'
        ? 'bg-emerald-100 text-emerald-800'
        : status === 'DRY_RUN' || dryRun
          ? 'bg-amber-100 text-amber-800'
          : status === 'PROCESSING'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-[#e6e1d8] text-black/65';

  return <span className={`w-fit rounded-full px-2 py-1 text-xs font-black ${tone}`}>{notificationJobStatusLabels[status] ?? status}</span>;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}
