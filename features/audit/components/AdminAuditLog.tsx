import type { getAuditLogEntries } from '../queries';
import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { Panel } from '@/components/ui/Panel';
import { Toolbar } from '@/components/ui/Toolbar';

type Entries = Awaited<ReturnType<typeof getAuditLogEntries>>;

export function AdminAuditLog({ entries, query }: { entries: Entries; query: string }) {
  return (
    <div className="space-y-3">
      <Panel>
        <Toolbar>
          <form method="get" className="flex w-full gap-2">
            <input name="q" defaultValue={query} placeholder="חיפוש לפי פעולה, ישות, לקוח, משתמש או requestId" className="ui-field bg-[var(--pantry-soft)]" />
            <button className="min-h-10 rounded-md bg-black px-4 text-sm font-semibold text-white">חיפוש</button>
          </form>
        </Toolbar>
        <p className="px-4 py-2 text-xs text-black/50">מוצגות עד 200 הפעולות האחרונות. הרשומות מוגנות משינוי ומחיקה ברמת מסד הנתונים.</p>
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-black/55">לא נמצאו רשומות מתאימות.</p>
        ) : (
          <DataTable minWidth="48rem">
            <thead>
              <tr>
                <Th>פעולה</Th>
                <Th>מבצע</Th>
                <Th>לקוח</Th>
                <Th>זמן</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top hover:bg-[var(--pantry-soft)]">
                  <Td>
                    <p className="font-medium">{entry.action}</p>
                    <p className="mt-0.5 text-xs text-black/50">{entry.entityType} · {entry.entityId}</p>
                    {(entry.before || entry.after || entry.metadata) && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer font-medium">פרטי שינוי</summary>
                        <pre dir="ltr" className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-black p-3 text-[11px] text-white">{JSON.stringify({ before: entry.before, after: entry.after, metadata: entry.metadata }, null, 2)}</pre>
                      </details>
                    )}
                  </Td>
                  <Td label="מבצע" className="text-xs">{entry.actorName}{entry.actorRole ? ` (${entry.actorRole})` : ''}</Td>
                  <Td label="לקוח" className="text-xs">{entry.customerName ?? '—'}</Td>
                  <Td label="זמן" className="whitespace-nowrap text-xs text-black/50">{formatDate(entry.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Jerusalem' }).format(new Date(value));
}
