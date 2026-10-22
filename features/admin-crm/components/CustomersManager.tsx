'use client';

import { useServerAction } from '@/components/hooks/useServerAction';
import { ActiveBadge } from '@/components/ui/Badge';
import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { CheckboxField, formValue, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { ActionFeedback, EmptyState } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { formatDate } from '@/lib/datetime';
import { formatMoney } from '@/lib/money';
import { paths } from '@/lib/paths';
import { orderStatusLabels } from '../../orders/status';
import { institutionalBusinessTypes } from '../../owner-rules/constants';
import { saveCustomerAction, toggleCustomerActiveAction } from '../actions/customers';
import type { CustomerManagementData } from '../queries';
import { FacetSelect, FormDialog, ListToolbar, RowActions, ToolbarSelect, useDialogTarget } from './crud';
import { compareDateDesc, compareText, useListView } from './list-view';

type Customer = CustomerManagementData['customers'][number];

export function CustomersManager({ data }: { data: CustomerManagementData }) {
  const action = useServerAction();
  const dialog = useDialogTarget();
  const editing = data.customers.find((customer) => customer.id === dialog.editingId) ?? null;
  const view = useListView({
    records: data.customers,
    searchText: (customer) => [customer.name, customer.contact, customer.phone, customer.email, customer.routeName],
    facets: { route: (customer) => customer.routeName },
    defaultSort: 'name',
    sorters: {
      name: (a, b) => compareText(a.name, b.name),
      recent: (a, b) => compareDateDesc(a.latestOrder?.submittedAt, b.latestOrder?.submittedAt),
      orders: (a, b) => b.orderCount - a.orderCount || compareText(a.name, b.name),
      newest: (a, b) => compareDateDesc(a.createdAt, b.createdAt),
    },
  });

  function save(form: FormData) {
    action.run(() => saveCustomerAction(readCustomerForm(form, editing?.id)), {
      success: editing ? 'פרטי הלקוח עודכנו.' : 'הלקוח נוצר. כעת אפשר להוסיף לו משתמש מכרטיס הלקוח.',
      onSuccess: dialog.close,
    });
  }

  return (
    <div className="space-y-3">
      <ActionFeedback feedback={dialog.target ? null : action.feedback} />
      <Panel>
        <ListToolbar view={view} searchPlaceholder="חיפוש לפי עסק, איש קשר, טלפון או קו" createLabel="לקוח חדש" onCreate={dialog.openCreate}>
          <FacetSelect view={view} facet="route" label="קו" allLabel="כל הקווים" />
          <ToolbarSelect
            label="מיון"
            value={view.sort}
            onChange={(value) => view.setSort(value as typeof view.sort)}
            options={[
              { value: 'name', label: 'שם' },
              { value: 'recent', label: 'הזמנה אחרונה' },
              { value: 'orders', label: 'הכי הרבה הזמנות' },
              { value: 'newest', label: 'הצטרף לאחרונה' },
            ]}
          />
        </ListToolbar>
        {view.visible.length === 0 ? (
          <EmptyState title="אין לקוחות מתאימים" description={data.customers.length ? 'נסו לשנות את החיפוש או הסינון.' : 'הוסיפו לקוח ראשון או המירו בקשת הצטרפות.'} />
        ) : (
          <DataTable minWidth="54rem">
            <thead>
              <tr>
                <Th>לקוח</Th>
                <Th>קו · מחירון</Th>
                <Th>הזמנה אחרונה</Th>
                <Th>סטטוס</Th>
                <Th className="text-left">פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {view.visible.map((customer) => (
                <tr key={customer.id} className="hover:bg-[var(--pantry-soft)]">
                  <Td>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-black/60">{customer.contact} · <span dir="ltr">{customer.phone}</span></p>
                  </Td>
                  <Td label="קו · מחירון" className="text-xs">{customer.routeName}<br /><span className="text-black/60">{customer.priceListName}</span></Td>
                  <Td label="הזמנה אחרונה" className="text-xs text-black/60">
                    {customer.latestOrder
                      ? `${orderStatusLabels[customer.latestOrder.status]} · ${formatMoney(customer.latestOrder.totalIncludingVat)}${customer.latestOrder.submittedAt ? ` · ${formatDate(customer.latestOrder.submittedAt)}` : ''}`
                      : 'אין הזמנות'}
                  </Td>
                  <Td label="סטטוס"><ActiveBadge active={customer.isActive} /></Td>
                  <Td actions>
                    <RowActions
                      viewHref={paths.admin.customer(customer.id)}
                      onEdit={() => dialog.openEdit(customer.id)}
                      active={customer.isActive}
                      onToggle={() => action.run(() => toggleCustomerActiveAction({ id: customer.id, isActive: !customer.isActive }), {
                        success: customer.isActive ? 'הלקוח הושבת וכל המשתמשים שלו נותקו.' : 'הלקוח הופעל.',
                      })}
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
        title={editing ? `עריכת ${editing.name}` : 'לקוח חדש'}
        action={action}
        onSubmit={save}
        onClose={dialog.close}
      >
        <CustomerFields key={editing?.id ?? 'new'} customer={editing} data={data} />
      </FormDialog>
    </div>
  );
}

function CustomerFields({ customer, data }: { customer: Customer | null; data: CustomerManagementData }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField name="name" label="שם העסק" defaultValue={customer?.name} required />
        <TextField name="invoiceName" label="שם לחשבונית" defaultValue={customer?.invoiceName} hint="אם שונה משם העסק" />
        <TextField name="contact" label="איש קשר להזמנות" defaultValue={customer?.contact} required />
        <TextField name="phone" label="טלפון" type="tel" dir="ltr" defaultValue={customer?.phone} required />
        <TextField name="email" label="אימייל" type="email" dir="ltr" defaultValue={customer?.email} hint="לאישורי הזמנה ותזכורות. משמש גם להתחברות." />
        <SelectField
          name="businessType"
          label="סוג עסק"
          defaultValue={customer?.businessType ?? ''}
          options={[{ value: '', label: 'לא נבחר' }, ...institutionalBusinessTypes.map((type) => ({ value: type, label: type }))]}
        />
        <SelectField name="routeId" label="קו חלוקה" defaultValue={customer?.routeId} required options={data.routes.map((route) => ({ value: route.id, label: route.isActive ? route.name : `${route.name} (לא פעיל)` }))} />
        <SelectField name="priceListId" label="מחירון" defaultValue={customer?.priceListId ?? data.priceLists.find((list) => list.isDefault)?.id} required options={data.priceLists.map((list) => ({ value: list.id, label: list.isDefault ? `${list.name} (ברירת מחדל)` : list.name }))} />
        <TextField name="address" label="כתובת" defaultValue={customer?.address} required />
        <TextField name="region" label="אזור" defaultValue={customer?.region} required />
      </div>
      <TextAreaField name="deliveryConstraints" label="אילוצי חלוקה" defaultValue={customer?.deliveryConstraints} hint="שעות, הוראות פריקה, ימים סגורים" />
      <details className="rounded-md border border-[var(--pantry-line)] p-3">
        <summary className="cursor-pointer text-sm font-semibold">הנהלת חשבונות והערות פנימיות</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <TextField name="accountingContactName" label="איש קשר לחשבונות" defaultValue={customer?.accountingContactName} />
          <TextField name="accountingEmail" label="אימייל לחשבונות" type="email" dir="ltr" defaultValue={customer?.accountingEmail} />
          <TextField name="accountingPhone" label="טלפון לחשבונות" type="tel" dir="ltr" defaultValue={customer?.accountingPhone} />
          <TextField name="statusLabel" label="תווית פנימית" defaultValue={customer?.statusLabel} hint="למשל: לקוח עונתי" />
        </div>
        <TextAreaField name="notes" label="הערות פנימיות" defaultValue={customer?.notes} className="mt-3" />
      </details>
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <CheckboxField name="isActive" label="לקוח פעיל" defaultChecked={customer?.isActive ?? true} />
        <CheckboxField name="emailEnabled" label="עדכונים ותזכורות במייל" defaultChecked={customer?.emailEnabled ?? true} />
        <CheckboxField name="whatsappEnabled" label="עדכונים בוואטסאפ" hint="יופעל כשחיבור הוואטסאפ העסקי יהיה מוכן" defaultChecked={customer?.whatsappEnabled ?? false} />
      </fieldset>
    </>
  );
}

function readCustomerForm(form: FormData, id?: string) {
  const text = (name: string) => formValue.text(form, name);
  return {
    ...(id ? { id } : {}),
    name: text('name'),
    invoiceName: text('invoiceName'),
    contact: text('contact'),
    email: text('email'),
    phone: text('phone'),
    accountingContactName: text('accountingContactName'),
    accountingEmail: text('accountingEmail'),
    accountingPhone: text('accountingPhone'),
    businessType: text('businessType'),
    region: text('region'),
    address: text('address'),
    deliveryConstraints: text('deliveryConstraints'),
    routeId: text('routeId'),
    priceListId: text('priceListId'),
    notes: text('notes'),
    statusLabel: text('statusLabel'),
    isActive: formValue.checkbox(form, 'isActive'),
    emailEnabled: formValue.checkbox(form, 'emailEnabled'),
    whatsappEnabled: formValue.checkbox(form, 'whatsappEnabled'),
  };
}
