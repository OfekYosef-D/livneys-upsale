'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, PhoneCall, UserPlus } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import {
  convertRegistrationToCustomerAction,
  updateRegistrationStatusAction,
} from '@/features/registration/actions';
import type { getRegistrationManagementData } from '@/features/registration/queries';

type RegistrationData = Awaited<ReturnType<typeof getRegistrationManagementData>>;
type StatusFilter = 'all' | RegistrationData['requests'][number]['status'];

const statusLabels: Record<RegistrationData['requests'][number]['status'], string> = {
  PENDING: 'חדש',
  CONTACTED: 'נוצר קשר',
  CONVERTED: 'הומר ללקוח',
  ARCHIVED: 'בארכיון',
};

export function AdminRegistrationsClient({ data }: { data: RegistrationData }) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [message, setMessage] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const visibleRequests = useMemo(
    () => status === 'all' ? data.requests : data.requests.filter((request) => request.status === status),
    [data.requests, status],
  );

  function run(id: string, call: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, success: string) {
    setMessage('');
    setPendingId(id);
    startTransition(async () => {
      const result = await call();
      setPendingId(null);
      if (result.ok) {
        setMessage(success);
        router.refresh();
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black">בקשות הרשמה</h2>
            <p className="mt-1 text-sm font-bold leading-6 text-black/55">פרטים שחברות חדשות שלחו מהעמוד הציבורי, לפני פתיחת לקוח במערכת.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'PENDING', 'CONTACTED', 'CONVERTED', 'ARCHIVED'] as StatusFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`min-h-9 rounded-full px-3 text-xs font-black focus-visible:ring-2 focus-visible:ring-black/25 ${status === item ? 'bg-black text-white' : 'bg-[#e6e1d8] text-black hover:bg-black hover:text-white'}`}
              >
                {item === 'all' ? 'הכל' : statusLabels[item]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {message && <p className="rounded-xl bg-[#e6e1d8] p-3 text-sm font-black" aria-live="polite">{message}</p>}

      {visibleRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
          <p className="text-base font-black">אין בקשות מתאימות</p>
          <p className="mt-1 text-sm font-bold text-black/45">נסו לשנות סינון סטטוס.</p>
        </div>
      ) : (
        <section className="grid min-w-0 gap-4 xl:grid-cols-2">
          {visibleRequests.map((request) => (
            <article key={request.id} className="min-w-0 rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-base font-black">{request.businessName}</p>
                  <p className="mt-1 break-words text-xs font-bold text-black/50">{request.businessType} · {request.contactName} · {request.phone}</p>
                  <p className="break-words text-xs font-bold text-black/45">{request.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#e6e1d8] px-3 py-1 text-xs font-black">{statusLabels[request.status]}</span>
              </div>

              <div className="mt-3 grid gap-2 text-xs font-bold text-black/60 md:grid-cols-2">
                <Info label="שם לחשבונית" value={request.invoiceName || request.businessName} />
                <Info label="כתובת" value={request.address} />
                <Info label="הנהלת חשבונות" value={[request.accountingContactName, request.accountingEmail, request.accountingPhone].filter(Boolean).join(' · ') || 'לא נמסר'} />
                <Info label="נשלח" value={new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(request.createdAt))} />
              </div>

              {(request.deliveryNotes || request.openingOrderNotes) && (
                <div className="mt-3 rounded-xl bg-[#f7f5f1] p-3 text-sm font-bold leading-6 text-black/65">
                  {request.deliveryNotes && <p><b>חלוקה:</b> {request.deliveryNotes}</p>}
                  {request.openingOrderNotes && <p><b>פתיחה:</b> {request.openingOrderNotes}</p>}
                </div>
              )}

              {request.convertedCustomerId ? (
                <Link href={`/admin/customers/${request.convertedCustomerId}`} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full bg-black px-4 text-sm font-black text-white">
                  צפייה בלקוח
                </Link>
              ) : (
                <div className="mt-4 space-y-3 border-t border-black/10 pt-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => run(request.id, () => updateRegistrationStatusAction({ id: request.id, status: 'CONTACTED' }), 'הבקשה סומנה כנוצר קשר.')}
                      disabled={isPending && pendingId === request.id}
                      className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-full bg-[#e6e1d8] px-3 text-xs font-black hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25 sm:flex-none"
                    >
                      <PhoneCall aria-hidden="true" size={14} /> נוצר קשר
                    </button>
                    <button
                      type="button"
                      onClick={() => run(request.id, () => updateRegistrationStatusAction({ id: request.id, status: 'ARCHIVED' }), 'הבקשה הועברה לארכיון.')}
                      disabled={isPending && pendingId === request.id}
                      className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-full bg-white px-3 text-xs font-black ring-1 ring-black/10 hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-black/25 sm:flex-none"
                    >
                      <Archive aria-hidden="true" size={14} /> ארכיון
                    </button>
                  </div>

                  <form
                    className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem] md:items-end"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      run(
                        request.id,
                        () =>
                          convertRegistrationToCustomerAction({
                            requestId: request.id,
                            routeId: stringValue(form, 'routeId'),
                            priceListId: stringValue(form, 'priceListId'),
                            temporaryPassword: stringValue(form, 'temporaryPassword') || 'livneys-demo',
                          }),
                        'הבקשה הומרה ללקוח פעיל.',
                      );
                    }}
                  >
                    <Select name="routeId" label="קו חלוקה" options={data.routes.map((route) => ({ value: route.id, label: route.name }))} />
                    <Select name="priceListId" label="מחירון" options={data.priceLists.map((priceList) => ({ value: priceList.id, label: `${priceList.name}${priceList.isDefault ? ' · ברירת מחדל' : ''}` }))} />
                    <label className="block">
                      <span className="mb-1 block text-xs font-black text-black/50">סיסמה זמנית</span>
                      <input name="temporaryPassword" defaultValue="livneys-demo" autoComplete="new-password" spellCheck={false} className={fieldClass} />
                    </label>
                    <button type="submit" disabled={isPending && pendingId === request.id} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-full bg-black px-3 text-xs font-black text-white focus-visible:ring-2 focus-visible:ring-black/25 disabled:bg-black/30 md:col-span-3">
                      <UserPlus aria-hidden="true" size={14} /> פתיחת לקוח וחשבון
                    </button>
                  </form>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p className="min-w-0">
      <span className="block text-[11px] font-black text-black/40">{label}</span>
      <span className="break-words">{value}</span>
    </p>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-black/50">{label}</span>
      <select name={name} className={fieldClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function stringValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

const fieldClass = 'w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-black focus:ring-2 focus:ring-black/10';
