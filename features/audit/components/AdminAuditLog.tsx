import type { getAuditLogEntries } from '../queries';

type Entries = Awaited<ReturnType<typeof getAuditLogEntries>>;

export function AdminAuditLog({ entries, query }: { entries: Entries; query: string }) {
  return (
    <div className="space-y-4">
      <form method="get" className="flex gap-2 rounded-2xl border border-black/10 bg-white p-3">
        <input name="q" defaultValue={query} placeholder="חיפוש לפי פעולה, ישות, לקוח, משתמש או requestId" className="min-h-11 min-w-0 flex-1 rounded-xl border border-black/15 px-4 text-sm font-bold" />
        <button className="min-h-11 rounded-full bg-black px-5 text-sm font-black text-white">חיפוש</button>
      </form>
      <p className="text-xs font-bold text-black/50">מוצגות עד 200 הפעולות האחרונות. הרשומות מוגנות משינוי ומחיקה ברמת מסד הנתונים.</p>
      <div className="space-y-3">
        {entries.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_12px_36px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-black">{entry.action}</p><p className="mt-1 text-xs font-bold text-black/50">{entry.entityType} · {entry.entityId}</p></div>
              <time className="text-xs font-black text-black/50">{formatDate(entry.createdAt)}</time>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-[#f7f5f1] px-3 py-1">מבצע: {entry.actorName}{entry.actorRole ? ` (${entry.actorRole})` : ''}</span>
              {entry.customerName && <span className="rounded-full bg-[#f7f5f1] px-3 py-1">לקוח: {entry.customerName}</span>}
              <span className="rounded-full bg-[#f7f5f1] px-3 py-1 font-mono">requestId: {entry.requestId}</span>
            </div>
            {(entry.before || entry.after || entry.metadata) && (
              <details className="mt-3 rounded-xl border border-black/10 p-3 text-xs"><summary className="cursor-pointer font-black">פרטי שינוי</summary><pre dir="ltr" className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black p-3 text-[11px] text-white">{JSON.stringify({ before: entry.before, after: entry.after, metadata: entry.metadata }, null, 2)}</pre></details>
            )}
          </article>
        ))}
        {entries.length === 0 && <p className="rounded-2xl border border-black/10 bg-white p-8 text-center text-sm font-bold text-black/55">לא נמצאו רשומות מתאימות.</p>}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Jerusalem' }).format(new Date(value));
}
