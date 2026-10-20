'use client';

import { useServerAction } from '@/components/hooks/useServerAction';
import { ActiveBadge } from '@/components/ui/Badge';
import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { CheckboxField, CheckboxGroup, formValue, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { ActionFeedback, EmptyState } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { formatDate, toDateTimeInputValue } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { promotionPresets } from '../../owner-rules/constants';
import { savePromotionAction, togglePromotionActiveAction } from '../actions/promotions';
import type { PromotionManagementData } from '../queries';
import { FormDialog, ListToolbar, RowActions, ToolbarSelect, useDialogTarget } from './crud';
import { compareDateAsc, compareText, useListView } from './list-view';

type Promotion = PromotionManagementData['promotions'][number];

const effectOptions = [
  { value: 'PERCENT_OFF', label: 'אחוז הנחה' },
  { value: 'FIXED_AMOUNT_OFF', label: 'הנחה בש״ח ליחידה' },
  { value: 'FIXED_UNIT_PRICE', label: 'מחיר מבצע ליחידה' },
  { value: 'BUY_X_GET_Y', label: 'קנה X קבל Y חינם' },
  { value: 'DISPLAY_ONLY', label: 'תווית בלבד (ללא הנחה)' },
];

function describeEffect(promotion: Promotion): string {
  switch (promotion.effectType) {
    case 'PERCENT_OFF': return `${promotion.discountValue ?? 0}% הנחה`;
    case 'FIXED_AMOUNT_OFF': return `${formatMoney(promotion.discountValue ?? 0)} הנחה ליחידה`;
    case 'FIXED_UNIT_PRICE': return `${formatMoney(promotion.discountValue ?? 0)} ליחידה`;
    case 'BUY_X_GET_Y': return `קנה ${promotion.buyQuantity ?? 0} קבל ${promotion.freeQuantity ?? 0}`;
    default: return 'תווית בלבד';
  }
}

function describeWindow(promotion: Promotion): string {
  if (!promotion.startsAt && !promotion.endsAt) return 'ללא הגבלת זמן';
  if (promotion.startsAt && promotion.endsAt) return `${formatDate(promotion.startsAt)} – ${formatDate(promotion.endsAt)}`;
  return promotion.startsAt ? `מ-${formatDate(promotion.startsAt)}` : `עד ${formatDate(promotion.endsAt!)}`;
}

export function PromotionsManager({ data }: { data: PromotionManagementData }) {
  const action = useServerAction();
  const dialog = useDialogTarget();
  const editing = data.promotions.find((promotion) => promotion.id === dialog.editingId) ?? null;
  const view = useListView({
    records: data.promotions,
    searchText: (promotion) => [promotion.title, promotion.tag, promotion.productName],
    defaultSort: 'priority',
    sorters: {
      priority: (a, b) => b.priority - a.priority || compareText(a.title, b.title),
      ending: (a, b) => compareDateAsc(a.endsAt, b.endsAt),
      title: (a, b) => compareText(a.title, b.title),
    },
  });

  return (
    <div className="space-y-3">
      <ActionFeedback feedback={dialog.target ? null : action.feedback} />
      <Panel>
        <ListToolbar view={view} searchPlaceholder="חיפוש מבצע או מוצר" createLabel="מבצע חדש" onCreate={dialog.openCreate}>
          <ToolbarSelect
            label="מיון"
            value={view.sort}
            onChange={(value) => view.setSort(value as typeof view.sort)}
            options={[{ value: 'priority', label: 'עדיפות' }, { value: 'ending', label: 'מסתיים בקרוב' }, { value: 'title', label: 'שם' }]}
          />
        </ListToolbar>
        {view.visible.length === 0 ? (
          <EmptyState title="אין מבצעים" description="מבצע פעיל מוצג ללקוחות בקטלוג ומחושב אוטומטית בהזמנה." />
        ) : (
          <DataTable minWidth="52rem">
            <thead>
              <tr>
                <Th>מבצע</Th>
                <Th>הטבה</Th>
                <Th>למי</Th>
                <Th>תוקף</Th>
                <Th>סטטוס</Th>
                <Th className="text-left">פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {view.visible.map((promotion) => (
                <tr key={promotion.id} className="hover:bg-[var(--pantry-soft)]">
                  <Td>
                    <p className="font-medium">{promotion.title}</p>
                    <p className="text-xs text-black/55">{promotion.tag} · {promotion.productName}</p>
                  </Td>
                  <Td label="הטבה" className="text-xs">{describeEffect(promotion)}</Td>
                  <Td label="למי" className="text-xs text-black/60">{promotion.targetSummary}</Td>
                  <Td label="תוקף" className="text-xs">{describeWindow(promotion)}</Td>
                  <Td label="סטטוס"><ActiveBadge active={promotion.isActive} /></Td>
                  <Td actions>
                    <RowActions
                      onEdit={() => dialog.openEdit(promotion.id)}
                      active={promotion.isActive}
                      onToggle={() => action.run(() => togglePromotionActiveAction({ id: promotion.id, isActive: !promotion.isActive }), { success: promotion.isActive ? 'המבצע הופסק.' : 'המבצע הופעל.' })}
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
        title={editing ? `עריכת ${editing.title}` : 'מבצע חדש'}
        action={action}
        onClose={dialog.close}
        onSubmit={(form) => action.run(() => savePromotionAction(readPromotionForm(form, editing?.id)), { success: editing ? 'המבצע עודכן.' : 'המבצע נוצר.', onSuccess: dialog.close })}
        impactNote="מבצע פעיל משפיע על מחירי הקטלוג ועל הזמנות חדשות בלבד. כשכמה מבצעים מתאימים, העדיפות הגבוהה קובעת."
      >
        <PromotionFields key={editing?.id ?? 'new'} promotion={editing} data={data} />
      </FormDialog>
    </div>
  );
}

function PromotionFields({ promotion, data }: { promotion: Promotion | null; data: PromotionManagementData }) {
  return (
    <>
      {!promotion && promotionPresets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {promotionPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="rounded-md bg-[var(--pantry-soft)] px-3 py-2 text-xs ring-1 ring-black/10 hover:bg-black hover:text-white"
              onClick={(event) => {
                const form = event.currentTarget.form;
                const set = (name: string, value: string | number) => {
                  const field = form?.elements.namedItem(name) as HTMLInputElement | null;
                  if (field) field.value = String(value);
                };
                set('title', preset.title);
                set('tag', preset.tag);
                set('description', preset.description);
                set('effectType', preset.effectType);
                set('discountValue', preset.discountValue);
              }}
            >
              תבנית: {preset.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <TextField name="title" label="שם המבצע" defaultValue={promotion?.title} required />
        <TextField name="tag" label="תווית בקטלוג" defaultValue={promotion?.tag} required hint='קצר, למשל "1+1" או "10% הנחה"' />
        <SelectField name="effectType" label="סוג ההטבה" defaultValue={promotion?.effectType ?? 'PERCENT_OFF'} options={effectOptions} />
        <TextField name="discountValue" label="ערך ההטבה" type="number" min={0} step={0.01} defaultValue={promotion?.discountValue} hint="אחוז / ש״ח הנחה / מחיר מבצע – לפי סוג ההטבה" />
        <TextField name="buyQuantity" label="קנה (כמות)" type="number" min={0} step={1} defaultValue={promotion?.buyQuantity} hint="רק ל״קנה X קבל Y״" />
        <TextField name="freeQuantity" label="קבל חינם (כמות)" type="number" min={0} step={1} defaultValue={promotion?.freeQuantity} hint="רק ל״קנה X קבל Y״" />
        <TextField name="startsAt" label="מתחיל ב (לא חובה)" type="datetime-local" defaultValue={toDateTimeInputValue(promotion?.startsAt)} />
        <TextField name="endsAt" label="מסתיים ב (לא חובה)" type="datetime-local" defaultValue={toDateTimeInputValue(promotion?.endsAt)} />
        <TextField name="priority" label="עדיפות" type="number" step={1} min={0} defaultValue={promotion?.priority ?? 0} hint="מספר גבוה גובר כשכמה מבצעים חלים" />
      </div>
      <TextAreaField name="description" label="תיאור ללקוח" defaultValue={promotion?.description} required />
      <div className="grid gap-3 lg:grid-cols-2">
        <CheckboxGroup title="מוצרים" name="productIds" selected={promotion?.productIds ?? []} options={data.products.map((product) => ({ value: product.id, label: product.isActive ? product.name : `${product.name} (לא פעיל)` }))} />
        <CheckboxGroup title="קטגוריות" name="categories" selected={promotion?.categories ?? []} options={data.categories.map((category) => ({ value: category, label: category }))} />
        <CheckboxGroup title="לקוחות" name="customerIds" selected={promotion?.customerIds ?? []} options={data.customers.map((customer) => ({ value: customer.id, label: customer.name }))} />
        <CheckboxGroup title="קווים" name="routeIds" selected={promotion?.routeIds ?? []} options={data.routes.map((route) => ({ value: route.id, label: route.name }))} />
        <CheckboxGroup title="מחירונים" name="priceListIds" selected={promotion?.priceListIds ?? []} options={data.priceLists.map((list) => ({ value: list.id, label: list.name }))} />
      </div>
      <CheckboxField name="isActive" label="מבצע פעיל" defaultChecked={promotion?.isActive ?? true} />
    </>
  );
}

function readPromotionForm(form: FormData, id?: string) {
  const text = (name: string) => formValue.text(form, name);
  return {
    ...(id ? { id } : {}),
    title: text('title'),
    tag: text('tag'),
    description: text('description'),
    effectType: text('effectType'),
    discountValue: text('discountValue'),
    buyQuantity: text('buyQuantity'),
    freeQuantity: text('freeQuantity'),
    priority: text('priority'),
    startsAt: text('startsAt'),
    endsAt: text('endsAt'),
    productIds: formValue.list(form, 'productIds'),
    categories: formValue.list(form, 'categories'),
    customerIds: formValue.list(form, 'customerIds'),
    routeIds: formValue.list(form, 'routeIds'),
    priceListIds: formValue.list(form, 'priceListIds'),
    isActive: formValue.checkbox(form, 'isActive'),
  };
}
