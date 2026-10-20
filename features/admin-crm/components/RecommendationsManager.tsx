'use client';

import { useServerAction } from '@/components/hooks/useServerAction';
import { ActiveBadge } from '@/components/ui/Badge';
import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { CheckboxField, formValue, SelectField, TextAreaField } from '@/components/ui/Field';
import { ActionFeedback, EmptyState } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { saveRecommendationAction, toggleRecommendationActiveAction } from '../actions/recommendations';
import type { RecommendationManagementData } from '../queries';
import { FacetSelect, FormDialog, ListToolbar, RowActions, useDialogTarget } from './crud';
import { compareDateDesc, compareText, useListView } from './list-view';

/** Upsell: products the team suggests to a specific customer ("מומלץ עבורכם" in the catalog). */
export function RecommendationsManager({ data }: { data: RecommendationManagementData }) {
  const action = useServerAction();
  const dialog = useDialogTarget();
  const editing = data.recommendations.find((item) => item.id === dialog.editingId) ?? null;
  const view = useListView({
    records: data.recommendations,
    searchText: (item) => [item.customerName, item.productName, item.reason],
    facets: { customer: (item) => item.customerName },
    defaultSort: 'updated',
    sorters: {
      updated: (a, b) => compareDateDesc(a.updatedAt, b.updatedAt),
      customer: (a, b) => compareText(a.customerName, b.customerName),
    },
  });

  return (
    <div className="space-y-3">
      <ActionFeedback feedback={dialog.target ? null : action.feedback} />
      <Panel>
        <ListToolbar view={view} searchPlaceholder="חיפוש לפי לקוח או מוצר" createLabel="המלצה חדשה" onCreate={dialog.openCreate}>
          <FacetSelect view={view} facet="customer" label="לקוח" allLabel="כל הלקוחות" />
        </ListToolbar>
        {view.visible.length === 0 ? (
          <EmptyState title="אין המלצות" description="המלצה מוסיפה ללקוח את התווית 'מומלץ עבורכם' על המוצר בקטלוג." />
        ) : (
          <DataTable minWidth="40rem">
            <thead>
              <tr>
                <Th>לקוח</Th>
                <Th>מוצר</Th>
                <Th>סיבה</Th>
                <Th>סטטוס</Th>
                <Th className="text-left">פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {view.visible.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--pantry-soft)]">
                  <Td className="font-medium">{item.customerName}</Td>
                  <Td label="מוצר">{item.productName}</Td>
                  <Td label="סיבה" className="text-xs text-black/60">{item.reason ?? '—'}</Td>
                  <Td label="סטטוס"><ActiveBadge active={item.isActive} /></Td>
                  <Td actions>
                    <RowActions
                      onEdit={() => dialog.openEdit(item.id)}
                      active={item.isActive}
                      onToggle={() => action.run(() => toggleRecommendationActiveAction({ id: item.id, isActive: !item.isActive }), { success: 'ההמלצה עודכנה.' })}
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
        title={editing ? 'עריכת המלצה' : 'המלצה חדשה'}
        action={action}
        onClose={dialog.close}
        onSubmit={(form) => action.run(
          () => saveRecommendationAction({
            ...(editing ? { id: editing.id } : {}),
            customerId: formValue.text(form, 'customerId'),
            productId: formValue.text(form, 'productId'),
            reason: formValue.text(form, 'reason'),
            isActive: formValue.checkbox(form, 'isActive'),
          }),
          { success: 'ההמלצה נשמרה.', onSuccess: dialog.close },
        )}
      >
        <div key={editing?.id ?? 'new'} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField name="customerId" label="לקוח" defaultValue={editing?.customerId} options={data.customers.map((customer) => ({ value: customer.id, label: customer.name }))} />
            <SelectField name="productId" label="מוצר" defaultValue={editing?.productId} options={data.products.map((product) => ({ value: product.id, label: product.name }))} />
          </div>
          <TextAreaField name="reason" label="למה זה מתאים ללקוח? (פנימי)" defaultValue={editing?.reason} />
          <CheckboxField name="isActive" label="פעילה" defaultChecked={editing?.isActive ?? true} />
        </div>
      </FormDialog>
    </div>
  );
}
