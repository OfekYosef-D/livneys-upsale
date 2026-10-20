'use client';

import { useServerAction } from '@/components/hooks/useServerAction';
import { ActiveBadge } from '@/components/ui/Badge';
import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { CheckboxField, formValue, SelectField, TextField } from '@/components/ui/Field';
import { ActionFeedback, EmptyState } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { formatShortDateTime, formatWeekdayDate, hebrewWeekdays } from '@/lib/datetime';
import { paths } from '@/lib/paths';
import { saveRouteAction, toggleRouteActiveAction } from '../actions/routes';
import type { RouteManagementData } from '../queries';
import { FormDialog, ListToolbar, RowActions, useDialogTarget } from './crud';
import { compareDateAsc, compareText, useListView } from './list-view';

type Route = RouteManagementData['routes'][number];

const weekdayOptions = hebrewWeekdays.map((day, index) => ({ value: String(index), label: `יום ${day}` }));

export function RoutesManager({ data }: { data: RouteManagementData }) {
  const action = useServerAction();
  const dialog = useDialogTarget();
  const editing = data.routes.find((route) => route.id === dialog.editingId) ?? null;
  const view = useListView({
    records: data.routes,
    searchText: (route) => [route.name, route.region, route.driver],
    defaultSort: 'delivery',
    sorters: {
      delivery: (a, b) => compareDateAsc(a.deliveryAt, b.deliveryAt),
      name: (a, b) => compareText(a.name, b.name),
    },
  });

  return (
    <div className="space-y-3">
      <ActionFeedback feedback={dialog.target ? null : action.feedback} />
      <Panel>
        <ListToolbar view={view} searchPlaceholder="חיפוש לפי קו, אזור או נהג" createLabel="קו חדש" onCreate={dialog.openCreate} />
        {view.visible.length === 0 ? (
          <EmptyState title="אין קווים" description="קו חלוקה מגדיר באיזה יום מגיעים ללקוחות ועד מתי אפשר להזמין." />
        ) : (
          <DataTable minWidth="48rem">
            <thead>
              <tr>
                <Th>קו</Th>
                <Th>חלוקה קרובה</Th>
                <Th>סגירת הזמנות</Th>
                <Th>לקוחות</Th>
                <Th>סטטוס</Th>
                <Th className="text-left">פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {view.visible.map((route) => (
                <tr key={route.id} className="hover:bg-[var(--pantry-soft)]">
                  <Td>
                    <p className="font-medium">{route.name}</p>
                    <p className="text-xs text-black/55">{route.region}{route.driver ? ` · ${route.driver}` : ''}</p>
                  </Td>
                  <Td className="text-xs">{formatWeekdayDate(route.deliveryAt)}</Td>
                  <Td className="text-xs">{formatShortDateTime(route.cutoffAt)}</Td>
                  <Td className="tabular-nums">{route.customerCount}</Td>
                  <Td><ActiveBadge active={route.isActive} /></Td>
                  <Td>
                    <RowActions
                      viewHref={paths.admin.route(route.id)}
                      onEdit={() => dialog.openEdit(route.id)}
                      active={route.isActive}
                      onToggle={() => action.run(() => toggleRouteActiveAction({ id: route.id, isActive: !route.isActive }), { success: route.isActive ? 'הקו הושבת.' : 'הקו הופעל.' })}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>

      <FormDialog
        open={Boolean(dialog.target)}
        title={editing ? `עריכת קו ${editing.name}` : 'קו חלוקה חדש'}
        description="החלוקה חוזרת כל שבוע באותו יום. ההזמנות נסגרות ביום ובשעה שנקבעו לפני כל חלוקה."
        action={action}
        onClose={dialog.close}
        onSubmit={(form) => action.run(() => saveRouteAction(readRouteForm(form, editing?.id)), { success: editing ? 'הקו עודכן.' : 'הקו נוצר.', onSuccess: dialog.close })}
      >
        <RouteFields key={editing?.id ?? 'new'} route={editing} />
      </FormDialog>
    </div>
  );
}

function RouteFields({ route }: { route: Route | null }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField name="name" label="שם הקו" defaultValue={route?.name} required />
        <TextField name="region" label="אזור" defaultValue={route?.region} required />
        <SelectField name="deliveryWeekday" label="יום חלוקה" defaultValue={route?.deliveryWeekday ?? 2} options={weekdayOptions} />
        <SelectField name="cutoffWeekday" label="יום סגירת הזמנות" defaultValue={route?.cutoffWeekday ?? 0} options={weekdayOptions} />
        <TextField name="cutoffTime" label="שעת סגירה" type="time" defaultValue={route?.cutoffTime ?? '18:00'} required />
        <TextField name="nextDeliveryDate" label="תאריך החלוקה הקרובה (לא חובה)" type="date" hint="רק אם החלוקה הקרובה זזה (למשל בגלל חג)" />
        <TextField name="driver" label="נהג" defaultValue={route?.driver} />
        <TextField name="opsContactName" label="איש קשר לתפעול" defaultValue={route?.opsContactName} />
        <TextField name="opsContactPhone" label="טלפון תפעול" type="tel" dir="ltr" defaultValue={route?.opsContactPhone} />
      </div>
      <CheckboxField name="isActive" label="קו פעיל" defaultChecked={route?.isActive ?? true} />
    </>
  );
}

function readRouteForm(form: FormData, id?: string) {
  const text = (name: string) => formValue.text(form, name);
  return {
    ...(id ? { id } : {}),
    name: text('name'),
    region: text('region'),
    driver: text('driver'),
    opsContactName: text('opsContactName'),
    opsContactPhone: text('opsContactPhone'),
    deliveryWeekday: text('deliveryWeekday'),
    cutoffWeekday: text('cutoffWeekday'),
    cutoffTime: text('cutoffTime'),
    nextDeliveryDate: text('nextDeliveryDate'),
    isActive: formValue.checkbox(form, 'isActive'),
  };
}
