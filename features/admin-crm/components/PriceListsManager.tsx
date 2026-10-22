'use client';

import { useState } from 'react';
import { useServerAction } from '@/components/hooks/useServerAction';
import { Badge } from '@/components/ui/Badge';
import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { CheckboxField, formValue, TextField } from '@/components/ui/Field';
import { ActionFeedback, EmptyState } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { formatMoney } from '@/lib/money';
import { clonePriceListAction, savePriceListAction } from '../actions/price-lists';
import type { PriceListManagementData } from '../queries';
import { FormDialog, ListToolbar, RowActions, useDialogTarget } from './crud';
import { compareText, useListView } from './list-view';

type PriceList = PriceListManagementData['priceLists'][number];

export function PriceListsManager({ data }: { data: PriceListManagementData }) {
  const action = useServerAction();
  const dialog = useDialogTarget();
  const [cloneSource, setCloneSource] = useState<PriceList | null>(null);
  const editing = data.priceLists.find((list) => list.id === dialog.editingId) ?? null;
  const view = useListView({
    records: data.priceLists,
    searchText: (list) => [list.name, list.description],
    defaultSort: 'name',
    sorters: { name: (a, b) => Number(b.isDefault) - Number(a.isDefault) || compareText(a.name, b.name) },
  });

  return (
    <div className="space-y-3">
      <ActionFeedback feedback={dialog.target || cloneSource ? null : action.feedback} />
      <Panel>
        <ListToolbar view={view} searchPlaceholder="חיפוש מחירון" createLabel="מחירון חדש" onCreate={dialog.openCreate} showStatus={false} />
        {view.visible.length === 0 ? (
          <EmptyState title="אין מחירונים" />
        ) : (
          <DataTable minWidth="40rem">
            <thead>
              <tr>
                <Th>מחירון</Th>
                <Th>מוצרים</Th>
                <Th>לקוחות</Th>
                <Th>טווח מחירים</Th>
                <Th className="text-left">פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {view.visible.map((list) => {
                const prices = list.items.map((item) => item.price);
                return (
                  <tr key={list.id} className="hover:bg-[var(--pantry-soft)]">
                    <Td>
                      <p className="flex items-center gap-2 font-medium">{list.name}{list.isDefault && <Badge>ברירת מחדל</Badge>}</p>
                      {list.description && <p className="text-xs text-black/60">{list.description}</p>}
                    </Td>
                    <Td label="מוצרים" className="tabular-nums">{list.items.length}</Td>
                    <Td label="לקוחות" className="tabular-nums">{list.customerCount}</Td>
                    <Td label="טווח מחירים" className="text-xs tabular-nums">{prices.length ? `${formatMoney(Math.min(...prices))} – ${formatMoney(Math.max(...prices))}` : '—'}</Td>
                    <Td actions>
                      <div className="flex justify-end gap-1">
                        <RowActions onEdit={() => dialog.openEdit(list.id)} />
                        <button type="button" onClick={() => setCloneSource(list)} className="rounded-md px-2 text-xs font-medium text-black/70 hover:bg-[var(--pantry)]">שכפול</button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Panel>

      <FormDialog
        open={Boolean(dialog.target)}
        title={editing ? `עריכת ${editing.name}` : 'מחירון חדש'}
        action={action}
        onClose={dialog.close}
        onSubmit={(form) => action.run(
          () => savePriceListAction({
            ...(editing ? { id: editing.id } : {}),
            name: formValue.text(form, 'name'),
            description: formValue.text(form, 'description'),
            isDefault: formValue.checkbox(form, 'isDefault'),
            prices: data.products.map((product) => ({ productId: product.id, price: formValue.text(form, `price:${product.id}`) })),
          }),
          { success: editing ? 'המחירון עודכן.' : 'המחירון נוצר.', onSuccess: dialog.close },
        )}
        impactNote="המחירים חלים על הזמנות חדשות של הלקוחות המשויכים למחירון. הזמנות קיימות לא ישתנו."
      >
        <PriceListFields key={editing?.id ?? 'new'} priceList={editing} products={data.products} />
      </FormDialog>

      <FormDialog
        open={Boolean(cloneSource)}
        title="שכפול מחירון"
        description="נוצר מחירון חדש עם אותם מחירים. אפשר לערוך אותו אחר כך."
        action={action}
        onClose={() => setCloneSource(null)}
        onSubmit={(form) => cloneSource && action.run(
          () => clonePriceListAction({ id: cloneSource.id, name: formValue.text(form, 'name') }),
          { success: 'המחירון שוכפל.', onSuccess: () => setCloneSource(null) },
        )}
      >
        <TextField name="name" label="שם המחירון החדש" defaultValue={cloneSource ? `${cloneSource.name} – עותק` : ''} required />
      </FormDialog>
    </div>
  );
}

function PriceListFields({ priceList, products }: { priceList: PriceList | null; products: PriceListManagementData['products'] }) {
  const prices = new Map(priceList?.items.map((item) => [item.productId, item.price]));
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField name="name" label="שם המחירון" defaultValue={priceList?.name} required />
        <TextField name="description" label="תיאור (לא חובה)" defaultValue={priceList?.description} />
      </div>
      <CheckboxField name="isDefault" label="מחירון ברירת מחדל" hint="לקוחות ומוצרים חדשים יקבלו אותו אוטומטית" defaultChecked={priceList?.isDefault ?? false} />
      <div className="overflow-hidden rounded-md border border-[var(--pantry-line)]">
        <div className="grid grid-cols-[1fr_7rem] gap-2 bg-[var(--pantry)] px-3 py-2 text-xs font-medium text-black/60">
          <span>מוצר</span>
          <span>מחיר (₪)</span>
        </div>
        <div className="max-h-[45vh] divide-y divide-[var(--pantry-line)] overflow-y-auto">
          {products.map((product) => (
            <label key={product.id} className="grid grid-cols-[1fr_7rem] items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 text-sm">{product.name}<span className="block text-[11px] text-black/60">{product.category}</span></span>
              <input name={`price:${product.id}`} type="number" min={0.01} step={0.01} inputMode="decimal" required defaultValue={prices.get(product.id) ?? product.basePrice} className="ui-field min-h-9 tabular-nums" />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
