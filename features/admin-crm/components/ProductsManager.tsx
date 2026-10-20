'use client';

import { useServerAction } from '@/components/hooks/useServerAction';
import { ActiveBadge } from '@/components/ui/Badge';
import { DataTable, Td, Th } from '@/components/ui/DataTable';
import { CheckboxField, formValue, TextAreaField, TextField } from '@/components/ui/Field';
import { ActionFeedback, EmptyState } from '@/components/ui/Notice';
import { Panel } from '@/components/ui/Panel';
import { formatMoney } from '@/lib/money';
import { ProductImage } from '../../catalog/components/ProductImage';
import { productPricePresets } from '../../owner-rules/constants';
import { bulkUpdateCategoryPricesAction, saveProductAction, toggleProductActiveAction, updateProductQuickAction } from '../actions/products';
import type { ProductManagementData } from '../queries';
import { FacetSelect, FormDialog, ListToolbar, RowActions, ToolbarSelect, useDialogTarget } from './crud';
import { compareText, useListView } from './list-view';
import { CategoryBulkPriceBar, InlineNumberField } from './ProductQuickEditors';
import { ProductImageField } from './ProductImageField';

type Product = ProductManagementData['products'][number];

export function ProductsManager({ data, imageUploadEnabled }: { data: ProductManagementData; imageUploadEnabled: boolean }) {
  const action = useServerAction();
  const dialog = useDialogTarget();
  const editing = data.products.find((product) => product.id === dialog.editingId) ?? null;
  const view = useListView({
    records: data.products,
    searchText: (product) => [product.name, product.sku, product.category, product.stockLabel],
    facets: { category: (product) => product.category },
    defaultStatus: 'active',
    defaultSort: 'category',
    sorters: {
      category: (a, b) => compareText(a.category, b.category) || compareText(a.name, b.name),
      name: (a, b) => compareText(a.name, b.name),
      priceAsc: (a, b) => a.price - b.price,
      priceDesc: (a, b) => b.price - a.price,
      popular: (a, b) => b.orderLineCount - a.orderLineCount,
    },
  });
  const activeCategories = [...new Set(data.products.filter((product) => product.isActive).map((product) => product.category))];

  function save(form: FormData) {
    action.run(() => saveProductAction(readProductForm(form, data.priceLists, editing?.id)), {
      success: editing ? 'המוצר עודכן.' : 'המוצר נוצר.',
      onSuccess: dialog.close,
    });
  }

  return (
    <div className="space-y-3">
      <ActionFeedback feedback={dialog.target ? null : action.feedback} />
      <Panel>
        <ListToolbar view={view} searchPlaceholder="חיפוש לפי שם, מק״ט או קטגוריה" createLabel="מוצר חדש" onCreate={dialog.openCreate}>
          <FacetSelect view={view} facet="category" label="קטגוריה" allLabel="כל הקטגוריות" />
          <ToolbarSelect
            label="מיון"
            value={view.sort}
            onChange={(value) => view.setSort(value as typeof view.sort)}
            options={[
              { value: 'category', label: 'קטגוריה' },
              { value: 'name', label: 'שם' },
              { value: 'priceAsc', label: 'מחיר: נמוך לגבוה' },
              { value: 'priceDesc', label: 'מחיר: גבוה לנמוך' },
              { value: 'popular', label: 'הכי נמכר' },
            ]}
          />
        </ListToolbar>
        <CategoryBulkPriceBar
          categories={activeCategories}
          countActive={(category) => data.products.filter((product) => product.isActive && product.category === category).length}
          pending={action.pending}
          onApply={(input) => action.run(() => bulkUpdateCategoryPricesAction(input), { success: (result) => `עודכנו ${result.updatedCount} מוצרים בקטגוריה ${result.category}.` })}
        />
        {view.visible.length === 0 ? (
          <EmptyState title="אין מוצרים מתאימים" description="נסו לשנות את החיפוש או הסינון." />
        ) : (
          <DataTable minWidth="56rem">
            <thead>
              <tr>
                <Th>מוצר</Th>
                <Th>קטגוריה</Th>
                <Th>מחיר (₪)</Th>
                <Th>מינימום</Th>
                <Th>סטטוס</Th>
                <Th className="text-left">פעולות</Th>
              </tr>
            </thead>
            <tbody>
              {view.visible.map((product) => (
                <tr key={`${product.id}:${product.price}:${product.minQty}`} className="hover:bg-[var(--pantry-soft)]">
                  <Td>
                    <div className="flex items-center gap-3">
                      <ProductImage product={product} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-black/50" dir="ltr">{product.sku}</p>
                      </div>
                    </div>
                  </Td>
                  <Td label="קטגוריה">{product.category}</Td>
                  <Td label="מחיר (₪)">
                    <InlineNumberField
                      label={`מחיר ${product.name}`}
                      value={product.price}
                      min={0.01}
                      step={0.01}
                      disabled={action.pending}
                      onCommit={(basePrice) => action.run(() => updateProductQuickAction({ id: product.id, basePrice }), { success: `המחיר של ${product.name} עודכן ל-${formatMoney(basePrice)} בכל המחירונים.` })}
                    />
                  </Td>
                  <Td label="מינימום">
                    <InlineNumberField
                      label={`כמות מינימום ${product.name}`}
                      value={product.minQty}
                      min={1}
                      step={1}
                      disabled={action.pending}
                      onCommit={(minQty) => action.run(() => updateProductQuickAction({ id: product.id, minQty }), { success: `המינימום של ${product.name} עודכן.` })}
                    />
                  </Td>
                  <Td label="סטטוס"><ActiveBadge active={product.isActive} /></Td>
                  <Td actions>
                    <RowActions
                      onEdit={() => dialog.openEdit(product.id)}
                      active={product.isActive}
                      onToggle={() => action.run(() => toggleProductActiveAction({ id: product.id, isActive: !product.isActive }), {
                        success: product.isActive ? 'המוצר הוסתר מהקטלוג.' : 'המוצר חזר לקטלוג.',
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
        title={editing ? `עריכת ${editing.name}` : 'מוצר חדש'}
        action={action}
        onSubmit={save}
        onClose={dialog.close}
        impactNote="שינויי מחיר חלים על הזמנות חדשות בלבד. הזמנות קיימות שומרות את המחיר שהיה בזמן ההזמנה."
      >
        <ProductFields key={editing?.id ?? 'new'} product={editing} priceLists={data.priceLists} imageUploadEnabled={imageUploadEnabled} />
      </FormDialog>
    </div>
  );
}

function ProductFields({ product, priceLists, imageUploadEnabled }: { product: Product | null; priceLists: ProductManagementData['priceLists']; imageUploadEnabled: boolean }) {
  const prices = new Map(product?.prices.map((item) => [item.priceListId, item.price]));

  return (
    <>
      {!product && (
        <fieldset className="rounded-md border border-[var(--pantry-line)] bg-[var(--pantry-soft)] p-3">
          <legend className="px-1 text-sm font-semibold">מילוי מהיר לפי סוג מוצר</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {productPricePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="rounded-md bg-white px-3 py-2 text-right text-xs ring-1 ring-black/10 hover:bg-black hover:text-white"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  const set = (name: string, value: string | number) => {
                    const field = form?.elements.namedItem(name) as HTMLInputElement | null;
                    if (field) field.value = String(value);
                  };
                  set('unit', preset.unit);
                  set('caseSize', preset.caseSize);
                  set('minQty', preset.minQty);
                  set('orderMultiple', preset.orderMultiple);
                  set('basePrice', preset.price);
                  priceLists.forEach((list) => set(`price:${list.id}`, preset.price));
                }}
              >
                <span className="block font-semibold">{preset.label}</span>
                <span className="opacity-70">{formatMoney(preset.price)} · מינימום {preset.minQty} · בכפולות {preset.orderMultiple}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <TextField name="name" label="שם המוצר" defaultValue={product?.name} required />
        <TextField name="category" label="קטגוריה" defaultValue={product?.category} required />
        <TextField name="sku" label="מק״ט" dir="ltr" defaultValue={product?.sku} hint="ריק = ייווצר אוטומטית" />
        <TextField name="basePrice" label="מחיר בסיס (₪ לפני מע״מ)" type="number" min={0.01} step={0.01} inputMode="decimal" defaultValue={product?.basePrice} required />
        <TextField name="unit" label="יחידה" defaultValue={product?.unit ?? 'צנצנת'} required />
        <TextField name="caseSize" label="גודל ארגז" defaultValue={product?.caseSize ?? '12 יחידות בארגז'} required />
        <TextField name="minQty" label="כמות מינימום" type="number" min={1} step={1} defaultValue={product?.minQty ?? 1} required />
        <TextField name="orderMultiple" label="בכפולות של" type="number" min={1} step={1} defaultValue={product?.orderMultiple ?? 1} required hint="למשל 6: אפשר להזמין 6, 12, 18…" />
        <TextField name="stockLabel" label="הערת מלאי (לא חובה)" defaultValue={product?.stockLabel} hint='מוצג ללקוח, למשל "חסר זמנית"' />
      </div>
      <TextAreaField name="description" label="תיאור (לא חובה)" defaultValue={product?.description} />
      <ProductImageField name="imageUrl" defaultUrl={product?.imageUrl ?? null} assetImage={product?.assetImage ?? null} uploadEnabled={imageUploadEnabled} />
      <input type="hidden" name="assetImage" defaultValue={product?.assetImage ?? ''} />
      <fieldset className="rounded-md border border-[var(--pantry-line)] p-3">
        <legend className="px-1 text-sm font-semibold">מחיר בכל מחירון</legend>
        <div className="mt-1 grid gap-2 md:grid-cols-2">
          {priceLists.map((list) => (
            <TextField
              key={list.id}
              name={`price:${list.id}`}
              label={list.isDefault ? `${list.name} (ברירת מחדל)` : list.name}
              type="number"
              min={0.01}
              step={0.01}
              inputMode="decimal"
              defaultValue={prices.get(list.id) ?? product?.basePrice}
              required
            />
          ))}
        </div>
      </fieldset>
      <CheckboxField name="isActive" label="מוצג בקטלוג" defaultChecked={product?.isActive ?? true} />
    </>
  );
}

function readProductForm(form: FormData, priceLists: ProductManagementData['priceLists'], id?: string) {
  const text = (name: string) => formValue.text(form, name);
  const name = text('name');
  return {
    ...(id ? { id } : {}),
    sku: text('sku') || generateSku(name),
    name,
    category: text('category'),
    description: text('description'),
    basePrice: text('basePrice'),
    unit: text('unit'),
    caseSize: text('caseSize'),
    minQty: text('minQty'),
    orderMultiple: text('orderMultiple'),
    imageUrl: text('imageUrl'),
    assetImage: text('assetImage'),
    stockLabel: text('stockLabel'),
    isActive: formValue.checkbox(form, 'isActive'),
    prices: priceLists.map((list) => ({ priceListId: list.id, price: text(`price:${list.id}`) })),
  };
}

function generateSku(name: string): string {
  const latin = name.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase().slice(0, 20);
  return `LIV-${latin || Date.now().toString(36).toUpperCase()}`;
}
