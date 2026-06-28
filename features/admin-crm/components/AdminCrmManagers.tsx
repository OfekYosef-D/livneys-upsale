'use client';

import Image from 'next/image';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Package, Save, Search, ShoppingCart } from 'lucide-react';
import {
  clonePriceListAction,
  createCustomerAction,
  createManualOrderAction,
  createPriceListAction,
  createProductAction,
  createPromotionAction,
  createRecommendationAction,
  createRouteAction,
  toggleCustomerActiveAction,
  toggleProductActiveAction,
  togglePromotionActiveAction,
  toggleRecommendationActiveAction,
  toggleRouteActiveAction,
  updateCustomerAction,
  updatePriceListAction,
  updateProductAction,
  updatePromotionAction,
  updateRecommendationAction,
  updateRouteAction,
} from '@/features/admin-crm/actions';
import {
  AdminActionButtons,
  AdminCrudPageHeader,
  AdminEmptyState,
  AdminFormDialog,
  AdminListToolbar,
  AdminStatusBadge,
  AdminToolbarSelect,
} from '@/features/admin-crm/components/AdminCrudUi';
import type {
  getCustomerManagementData,
  getManualOrderData,
  getPriceListManagementData,
  getProductManagementData,
  getPromotionManagementData,
  getRecommendationManagementData,
  getRouteManagementData,
} from '@/features/admin-crm/queries';
import {
  compareNullableDateAsc,
  compareNullableDateDesc,
  compareNumberAsc,
  compareNumberDesc,
  compareText,
  filterAdminRecords,
  filterByValue,
  getUniqueFilterValues,
  resolveProductThumbnail,
  sortAdminRecords,
  type AdminStatusFilter,
} from '@/features/admin-crm/ui-utils';
import type { ActionResult } from '@/lib/action-result';
import { money } from '@/lib/format';
import { getCartPricingSummary } from '@/lib/order-utils';
import { productImages } from '@/lib/product-assets';

type CustomerData = Awaited<ReturnType<typeof getCustomerManagementData>>;
type ProductData = Awaited<ReturnType<typeof getProductManagementData>>;
type PriceListData = Awaited<ReturnType<typeof getPriceListManagementData>>;
type RouteData = Awaited<ReturnType<typeof getRouteManagementData>>;
type PromotionData = Awaited<ReturnType<typeof getPromotionManagementData>>;
type RecommendationData = Awaited<ReturnType<typeof getRecommendationManagementData>>;
type ManualOrderData = Awaited<ReturnType<typeof getManualOrderData>>;
type DialogState = { mode: 'create' } | { mode: 'edit'; id: string } | null;
type PriceListDialogState = { mode: 'create' } | { mode: 'edit'; id: string } | { mode: 'clone'; id: string } | null;
type CustomerSort = 'recent' | 'name' | 'route' | 'orders';
type ProductSort = 'name' | 'category' | 'priceAsc' | 'priceDesc' | 'activity';
type RouteSort = 'cutoff' | 'name' | 'customers' | 'orders';
type PromotionSort = 'recent' | 'ending' | 'title' | 'product';
type PromotionWindowFilter = 'all' | 'running' | 'upcoming' | 'ended' | 'open';
type RecommendationSort = 'updated' | 'customer' | 'product' | 'missingReason';
type ManualProductSort = 'name' | 'category' | 'priceAsc' | 'priceDesc' | 'minQty';

export function AdminCustomersManager({ data }: { data: CustomerData }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminStatusFilter>('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [sort, setSort] = useState<CustomerSort>('recent');
  const action = useCrmAction();
  const editing = dialog?.mode === 'edit' ? data.customers.find((customer) => customer.id === dialog.id) ?? null : null;
  const routeOptions = useMemo(() => getUniqueFilterValues(data.customers, (customer) => customer.routeName), [data.customers]);
  const filtered = useMemo(
    () => {
      const searched = filterAdminRecords(data.customers, {
        search,
        status,
        getSearchText: (customer) => [customer.name, customer.contact, customer.phone, customer.email, customer.routeName, customer.priceListName],
      });
      const routed = filterByValue(searched, routeFilter, (customer) => customer.routeName);

      return sortAdminRecords(routed, sort, {
        recent: (a, b) => compareNullableDateDesc(a.latestOrder?.submittedAt, b.latestOrder?.submittedAt),
        name: (a, b) => compareText(a.name, b.name),
        route: (a, b) => compareText(a.routeName, b.routeName) || compareText(a.name, b.name),
        orders: (a, b) => compareNumberDesc(a.orderCount, b.orderCount) || compareText(a.name, b.name),
      });
    },
    [data.customers, routeFilter, search, sort, status],
  );

  return (
    <div className="space-y-4">
      <AdminCrudPageHeader title="לקוחות" description="רשימת לקוחות תפעולית עם קו, מחירון, פרטי קשר והיסטוריית הזמנה אחרונה." actionLabel="הוסף לקוח" onAction={() => setDialog({ mode: 'create' })} />
      <ActionMessage message={!dialog ? action.message : null} />
      <AdminListToolbar search={search} onSearch={setSearch} status={status} onStatus={setStatus} count={filtered.length} total={data.customers.length} searchLabel="חיפוש לפי עסק, איש קשר, טלפון או קו">
        <AdminToolbarSelect label="קו" value={routeFilter} onChange={setRouteFilter} options={[{ value: 'all', label: 'כל הקווים' }, ...routeOptions.map((route) => ({ value: route, label: route }))]} />
        <AdminToolbarSelect
          label="מיון"
          value={sort}
          onChange={(value) => setSort(value as CustomerSort)}
          options={[
            { value: 'recent', label: 'הזמנה אחרונה' },
            { value: 'name', label: 'שם לקוח' },
            { value: 'route', label: 'לפי קו' },
            { value: 'orders', label: 'יותר הזמנות' },
          ]}
        />
      </AdminListToolbar>

      {filtered.length === 0 ? (
        <AdminEmptyState title="אין לקוחות מתאימים" description="נסה לשנות את החיפוש או את סינון הסטטוס." />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
          <div className="divide-y divide-black/10">
            {filtered.map((customer) => (
              <article key={customer.id} className="grid gap-3 px-4 py-4 hover:bg-[#f7f5f1] lg:grid-cols-[minmax(0,1.15fr)_minmax(8rem,.9fr)_minmax(7rem,.8fr)_minmax(8rem,.8fr)_7rem_minmax(11rem,13rem)] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{customer.name}</p>
                  <p className="truncate text-xs font-bold text-black/50">{customer.contact} · {customer.phone}</p>
                  {customer.email && <p className="truncate text-xs font-bold text-black/40">{customer.email}</p>}
                </div>
                <SmallStack label="קו" value={customer.routeName} />
                <SmallStack label="מחירון" value={customer.priceListName} />
                <SmallStack label="הזמנה אחרונה" value={customer.latestOrder ? `${orderStatusLabel(customer.latestOrder.status)} · ${money(customer.latestOrder.total)}` : 'אין הזמנות'} />
                <AdminStatusBadge active={customer.isActive} />
                <AdminActionButtons
                  viewHref={`/admin/customers/${customer.id}`}
                  active={customer.isActive}
                  onEdit={() => setDialog({ mode: 'edit', id: customer.id })}
                  onToggle={() =>
                    action.run(
                      () => toggleCustomerActiveAction({ id: customer.id, isActive: !customer.isActive }),
                      customer.isActive ? 'הלקוח הושבת.' : 'הלקוח הופעל.',
                    )
                  }
                />
              </article>
            ))}
          </div>
        </section>
      )}

      <AdminFormDialog open={Boolean(dialog)} title={editing ? 'עריכת לקוח' : 'לקוח חדש'} description="שמירה תפעולית של פרטי לקוח, קו, מחירון והעדפות הודעה." message={dialog ? action.message : null} onClose={() => setDialog(null)}>
        <CustomerForm
          key={editing?.id ?? 'new-customer'}
          customer={editing}
          routes={data.routes}
          priceLists={data.priceLists}
          pending={action.pending}
          onCancel={() => setDialog(null)}
          onSubmit={(form) => {
            action.run(
              () => (editing ? updateCustomerAction(readCustomerForm(form, editing.id)) : createCustomerAction(readCustomerForm(form))),
              editing ? 'הלקוח עודכן.' : 'הלקוח נוצר.',
              () => setDialog(null),
            );
          }}
        />
      </AdminFormDialog>
    </div>
  );
}

export function AdminPriceListsManager({ data }: { data: PriceListData }) {
  const [dialog, setDialog] = useState<PriceListDialogState>(null);
  const [search, setSearch] = useState('');
  const action = useCrmAction();
  const selected = dialog?.mode === 'edit' || dialog?.mode === 'clone' ? data.priceLists.find((priceList) => priceList.id === dialog.id) ?? null : null;
  const filtered = useMemo(
    () => {
      const normalizedSearch = search.trim().toLowerCase();
      if (!normalizedSearch) return data.priceLists;

      return data.priceLists.filter((priceList) =>
        [priceList.name, priceList.description, ...priceList.items.map((item) => item.productName)]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLowerCase().includes(normalizedSearch)),
      );
    },
    [data.priceLists, search],
  );

  return (
    <div className="space-y-4">
      <AdminCrudPageHeader title="מחירונים" description="שליטה מלאה במחירי כל מוצר לפי מחירון. שינוי כאן משפיע על קטלוג הלקוחות והזמנות ידניות." actionLabel="הוסף מחירון" onAction={() => setDialog({ mode: 'create' })} />
      <ActionMessage message={!dialog ? action.message : null} />
      <div className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white p-3 shadow-[0_14px_42px_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי מחירון או מוצר" className="min-h-10 w-full rounded-full border border-black/10 bg-[#f7f5f1] py-2 pl-3 pr-10 text-sm font-bold outline-none focus:border-black focus:ring-2 focus:ring-black/10" />
        </label>
        <span className="w-fit rounded-full bg-[#e6e1d8] px-3 py-2 text-xs font-black text-black/60">{filtered.length}/{data.priceLists.length}</span>
      </div>

      {filtered.length === 0 ? (
        <AdminEmptyState title="אין מחירונים מתאימים" description="נסה לשנות את החיפוש." />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filtered.map((priceList) => {
            const prices = priceList.items.map((item) => item.price);
            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
            const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

            return (
              <article key={priceList.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">{priceList.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-black/55">{priceList.description || 'ללא תיאור'}</p>
                  </div>
                  {priceList.isDefault && <span className="shrink-0 rounded-full bg-black px-2 py-1 text-xs font-black text-white">ברירת מחדל</span>}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricPill label="מוצרים" value={String(priceList.items.length)} />
                  <MetricPill label="לקוחות" value={String(priceList.customerCount)} />
                  <MetricPill label="מינימום" value={money(minPrice)} />
                  <MetricPill label="מקסימום" value={money(maxPrice)} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-black/10 pt-3">
                  <button type="button" onClick={() => setDialog({ mode: 'edit', id: priceList.id })} className="min-h-9 flex-1 rounded-full bg-[#e6e1d8] px-3 text-xs font-black hover:bg-black hover:text-white sm:flex-none">
                    עריכה
                  </button>
                  <button type="button" onClick={() => setDialog({ mode: 'clone', id: priceList.id })} className="min-h-9 flex-1 rounded-full bg-white px-3 text-xs font-black ring-1 ring-black/10 hover:bg-black hover:text-white sm:flex-none">
                    שכפול
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <AdminFormDialog
        open={Boolean(dialog)}
        title={dialog?.mode === 'clone' ? 'שכפול מחירון' : selected ? 'עריכת מחירון' : 'מחירון חדש'}
        description={dialog?.mode === 'clone' ? 'נוצר מחירון חדש עם אותם מחירי מוצר.' : 'עריכת כל מחירי המוצרים במחירון אחד.'}
        message={dialog ? action.message : null}
        onClose={() => setDialog(null)}
      >
        {dialog?.mode === 'clone' && selected ? (
          <ClonePriceListForm
            source={selected}
            pending={action.pending}
            onCancel={() => setDialog(null)}
            onSubmit={(form) => {
              action.run(
                () => clonePriceListAction({ id: selected.id, name: stringValue(form, 'name') }),
                'המחירון שוכפל.',
                () => setDialog(null),
              );
            }}
          />
        ) : (
          <PriceListForm
            key={selected?.id ?? 'new-price-list'}
            priceList={selected}
            products={data.products}
            pending={action.pending}
            onCancel={() => setDialog(null)}
            onSubmit={(form) => {
              action.run(
                () => (selected ? updatePriceListAction(readPriceListForm(form, data.products, selected.id)) : createPriceListAction(readPriceListForm(form, data.products))),
                selected ? 'המחירון עודכן.' : 'המחירון נוצר.',
                () => setDialog(null),
              );
            }}
          />
        )}
      </AdminFormDialog>
    </div>
  );
}

export function AdminProductsManager({ data }: { data: ProductData }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminStatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState<ProductSort>('category');
  const action = useCrmAction();
  const editing = dialog?.mode === 'edit' ? data.products.find((product) => product.id === dialog.id) ?? null : null;
  const categoryOptions = useMemo(() => getUniqueFilterValues(data.products, (product) => product.category), [data.products]);
  const filtered = useMemo(
    () => {
      const searched = filterAdminRecords(data.products, {
        search,
        status,
        getSearchText: (product) => [product.name, product.sku, product.category, product.caseSize, product.stockLabel],
      });
      const categorized = filterByValue(searched, categoryFilter, (product) => product.category);

      return sortAdminRecords(categorized, sort, {
        name: (a, b) => compareText(a.name, b.name),
        category: (a, b) => compareText(a.category, b.category) || compareText(a.name, b.name),
        priceAsc: (a, b) => compareNumberAsc(a.defaultPrice ?? a.basePrice, b.defaultPrice ?? b.basePrice),
        priceDesc: (a, b) => compareNumberDesc(a.defaultPrice ?? a.basePrice, b.defaultPrice ?? b.basePrice),
        activity: (a, b) => compareNumberDesc(a.orderLineCount, b.orderLineCount) || compareText(a.name, b.name),
      });
    },
    [categoryFilter, data.products, search, sort, status],
  );

  return (
    <div className="space-y-4">
      <AdminCrudPageHeader title="מוצרים" description="קטלוג תפעולי עם תמונות, SKU, מחיר בסיס, כמות מינימום וזמינות." actionLabel="הוסף מוצר" onAction={() => setDialog({ mode: 'create' })} />
      <ActionMessage message={!dialog ? action.message : null} />
      <AdminListToolbar search={search} onSearch={setSearch} status={status} onStatus={setStatus} count={filtered.length} total={data.products.length} searchLabel="חיפוש לפי שם, SKU או קטגוריה">
        <AdminToolbarSelect label="קטגוריה" value={categoryFilter} onChange={setCategoryFilter} options={[{ value: 'all', label: 'כל הקטגוריות' }, ...categoryOptions.map((category) => ({ value: category, label: category }))]} />
        <AdminToolbarSelect
          label="מיון"
          value={sort}
          onChange={(value) => setSort(value as ProductSort)}
          options={[
            { value: 'category', label: 'קטגוריה ואז שם' },
            { value: 'name', label: 'שם מוצר' },
            { value: 'priceAsc', label: 'מחיר נמוך' },
            { value: 'priceDesc', label: 'מחיר גבוה' },
            { value: 'activity', label: 'נמכר יותר' },
          ]}
        />
      </AdminListToolbar>

      {filtered.length === 0 ? (
        <AdminEmptyState title="אין מוצרים מתאימים" description="נסה לשנות את החיפוש או את סינון הסטטוס." />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((product) => (
            <article key={product.id} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.06)]">
              <ProductThumbnail name={product.name} assetImage={product.assetImage} imageUrl={product.imageUrl} variant="card" />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">{product.name}</p>
                    <p className="mt-1 truncate text-xs font-bold text-black/50">{product.sku} / {product.category}</p>
                  </div>
                  <AdminStatusBadge active={product.isActive} />
                </div>

                {product.description && <p className="mt-3 line-clamp-2 min-h-[3rem] text-sm font-bold leading-6 text-black/60">{product.description}</p>}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <MetricPill label="מחיר" value={money(product.defaultPrice ?? product.basePrice)} />
                  <MetricPill label="מינימום" value={String(product.minQty)} />
                  <MetricPill label="יחידה" value={product.unit} />
                  <MetricPill label="מארז" value={product.caseSize} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-black/10 pt-3">
                  <SmallStack label="הזמנות" value={String(product.orderLineCount)} />
                  <SmallStack label="מבצעים" value={String(product.promotionCount)} />
                  <SmallStack label="המלצות" value={String(product.recommendationCount)} />
                </div>

                <div className="mt-auto border-t border-black/10 pt-3">
                  <AdminActionButtons
                    active={product.isActive}
                    onEdit={() => setDialog({ mode: 'edit', id: product.id })}
                    onToggle={() =>
                      action.run(
                        () => toggleProductActiveAction({ id: product.id, isActive: !product.isActive }),
                        product.isActive ? 'המוצר הושבת.' : 'המוצר הופעל.',
                      )
                    }
                  />
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <AdminFormDialog open={Boolean(dialog)} title={editing ? 'עריכת מוצר' : 'מוצר חדש'} description="מוצר נשמר עם מחיר בסיס ומחירון ברירת מחדל ללא שינוי היסטוריית הזמנות." message={dialog ? action.message : null} onClose={() => setDialog(null)}>
        <ProductForm
          key={editing?.id ?? 'new-product'}
          product={editing}
          priceLists={data.priceLists}
          pending={action.pending}
          onCancel={() => setDialog(null)}
          onSubmit={(form) => {
            action.run(
              () => (editing ? updateProductAction(readProductForm(form, data.priceLists, editing.id)) : createProductAction(readProductForm(form, data.priceLists))),
              editing ? 'המוצר עודכן.' : 'המוצר נוצר.',
              () => setDialog(null),
            );
          }}
        />
      </AdminFormDialog>
    </div>
  );
}

export function AdminRoutesManager({ data }: { data: RouteData }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminStatusFilter>('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sort, setSort] = useState<RouteSort>('cutoff');
  const action = useCrmAction();
  const editing = dialog?.mode === 'edit' ? data.routes.find((route) => route.id === dialog.id) ?? null : null;
  const regionOptions = useMemo(() => getUniqueFilterValues(data.routes, (route) => route.region), [data.routes]);
  const filtered = useMemo(
    () => {
      const searched = filterAdminRecords(data.routes, {
        search,
        status,
        getSearchText: (route) => [route.name, route.region, route.driver, route.opsContactName, route.opsContactPhone],
      });
      const regional = filterByValue(searched, regionFilter, (route) => route.region);

      return sortAdminRecords(regional, sort, {
        cutoff: (a, b) => compareNullableDateAsc(a.nextCutoffAt, b.nextCutoffAt),
        name: (a, b) => compareText(a.name, b.name),
        customers: (a, b) => compareNumberDesc(a.customerCount, b.customerCount) || compareText(a.name, b.name),
        orders: (a, b) => compareNumberDesc(a.orderCount, b.orderCount) || compareText(a.name, b.name),
      });
    },
    [data.routes, regionFilter, search, sort, status],
  );

  return (
    <div className="space-y-4">
      <AdminCrudPageHeader title="קווים" description="ניהול קווי חלוקה, דדליינים, נהגים ואנשי קשר תפעוליים." actionLabel="הוסף קו" onAction={() => setDialog({ mode: 'create' })} />
      <ActionMessage message={!dialog ? action.message : null} />
      <AdminListToolbar search={search} onSearch={setSearch} status={status} onStatus={setStatus} count={filtered.length} total={data.routes.length} searchLabel="חיפוש לפי קו, אזור, נהג או איש קשר">
        <AdminToolbarSelect label="אזור" value={regionFilter} onChange={setRegionFilter} options={[{ value: 'all', label: 'כל האזורים' }, ...regionOptions.map((region) => ({ value: region, label: region }))]} />
        <AdminToolbarSelect
          label="מיון"
          value={sort}
          onChange={(value) => setSort(value as RouteSort)}
          options={[
            { value: 'cutoff', label: 'דדליין קרוב' },
            { value: 'name', label: 'שם קו' },
            { value: 'customers', label: 'יותר לקוחות' },
            { value: 'orders', label: 'יותר הזמנות' },
          ]}
        />
      </AdminListToolbar>

      {filtered.length === 0 ? (
        <AdminEmptyState title="אין קווים מתאימים" description="נסה לשנות את החיפוש או את סינון הסטטוס." />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filtered.map((route) => (
            <article key={route.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">קו {route.name}</p>
                  <p className="text-xs font-bold text-black/50">{route.region}</p>
                </div>
                <AdminStatusBadge active={route.isActive} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                <MetricPill label="נהג" value={route.driver ?? 'לא הוגדר'} />
                <MetricPill label="לקוחות" value={String(route.customerCount)} />
                <MetricPill label="הזמנות" value={String(route.orderCount)} />
                <MetricPill label="דדליין" value={new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(route.nextCutoffAt))} />
              </div>
              <div className="mt-3">
                <AdminActionButtons
                  viewHref={`/admin/routes/${route.id}`}
                  active={route.isActive}
                  onEdit={() => setDialog({ mode: 'edit', id: route.id })}
                  onToggle={() =>
                    action.run(
                      () => toggleRouteActiveAction({ id: route.id, isActive: !route.isActive }),
                      route.isActive ? 'הקו הושבת.' : 'הקו הופעל.',
                    )
                  }
                />
              </div>
            </article>
          ))}
        </section>
      )}

      <AdminFormDialog open={Boolean(dialog)} title={editing ? 'עריכת קו' : 'קו חדש'} description="עדכון חלונות חלוקה, דדליינים ואנשי קשר תפעוליים." message={dialog ? action.message : null} onClose={() => setDialog(null)}>
        <RouteForm
          key={editing?.id ?? 'new-route'}
          route={editing}
          pending={action.pending}
          onCancel={() => setDialog(null)}
          onSubmit={(form) => {
            action.run(
              () => (editing ? updateRouteAction(readRouteForm(form, editing.id)) : createRouteAction(readRouteForm(form))),
              editing ? 'הקו עודכן.' : 'הקו נוצר.',
              () => setDialog(null),
            );
          }}
        />
      </AdminFormDialog>
    </div>
  );
}

export function AdminPromotionsManager({ data }: { data: PromotionData }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminStatusFilter>('all');
  const [productFilter, setProductFilter] = useState('all');
  const [windowFilter, setWindowFilter] = useState<PromotionWindowFilter>('all');
  const [sort, setSort] = useState<PromotionSort>('ending');
  const action = useCrmAction();
  const editing = dialog?.mode === 'edit' ? data.promotions.find((promotion) => promotion.id === dialog.id) ?? null : null;
  const productOptions = useMemo(() => getUniqueFilterValues(data.promotions, (promotion) => promotion.productName), [data.promotions]);
  const filtered = useMemo(
    () => {
      const searched = filterAdminRecords(data.promotions, {
        search,
        status,
        getSearchText: (promotion) => [promotion.title, promotion.tag, promotion.description, promotion.productName],
      });
      const byProduct = filterByValue(searched, productFilter, (promotion) => promotion.productName);
      const byWindow = byProduct.filter((promotion) => promotionMatchesWindow(promotion.startsAt, promotion.endsAt, windowFilter));

      return sortAdminRecords(byWindow, sort, {
        recent: (a, b) => compareNullableDateDesc(a.startsAt, b.startsAt),
        ending: (a, b) => compareNullableDateAsc(a.endsAt, b.endsAt),
        title: (a, b) => compareText(a.title, b.title),
        product: (a, b) => compareText(a.productName, b.productName) || compareText(a.title, b.title),
      });
    },
    [data.promotions, productFilter, search, sort, status, windowFilter],
  );

  return (
    <div className="space-y-4">
      <AdminCrudPageHeader title="מבצעים" description="מבצעי מוצר פשוטים לניהול ידני, בלי מנוע המלצות מורכב." actionLabel="הוסף מבצע" onAction={() => setDialog({ mode: 'create' })} />
      <ActionMessage message={!dialog ? action.message : null} />
      <AdminListToolbar search={search} onSearch={setSearch} status={status} onStatus={setStatus} count={filtered.length} total={data.promotions.length} searchLabel="חיפוש לפי מבצע, תג או מוצר">
        <AdminToolbarSelect label="מוצר" value={productFilter} onChange={setProductFilter} options={[{ value: 'all', label: 'כל המוצרים' }, ...productOptions.map((product) => ({ value: product, label: product }))]} />
        <AdminToolbarSelect
          label="תזמון"
          value={windowFilter}
          onChange={(value) => setWindowFilter(value as PromotionWindowFilter)}
          options={[
            { value: 'all', label: 'כל התאריכים' },
            { value: 'running', label: 'רץ עכשיו' },
            { value: 'upcoming', label: 'עתידי' },
            { value: 'ended', label: 'הסתיים' },
            { value: 'open', label: 'ללא הגבלה' },
          ]}
        />
        <AdminToolbarSelect
          label="מיון"
          value={sort}
          onChange={(value) => setSort(value as PromotionSort)}
          options={[
            { value: 'ending', label: 'מסתיים בקרוב' },
            { value: 'recent', label: 'התחלה חדשה' },
            { value: 'title', label: 'כותרת' },
            { value: 'product', label: 'מוצר' },
          ]}
        />
      </AdminListToolbar>

      {filtered.length === 0 ? (
        <AdminEmptyState title="אין מבצעים מתאימים" description="נסה לשנות את החיפוש או את סינון הסטטוס." />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filtered.map((promotion) => (
            <article key={promotion.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{promotion.title}</p>
                  <p className="truncate text-xs font-bold text-black/50">{promotion.tag} · {promotion.productName}</p>
                </div>
                <AdminStatusBadge active={promotion.isActive} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-black/60">{promotion.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MetricPill label="כלל" value={formatPromotionEffect(promotion)} />
                <MetricPill label="יעדים" value={promotion.targetSummary} />
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-black/10 pt-3 sm:flex-row sm:items-end sm:justify-between">
                <SmallStack label="תאריכים" value={formatRange(promotion.startsAt, promotion.endsAt)} />
                <AdminActionButtons
                  active={promotion.isActive}
                  onEdit={() => setDialog({ mode: 'edit', id: promotion.id })}
                  onToggle={() =>
                    action.run(
                      () => togglePromotionActiveAction({ id: promotion.id, isActive: !promotion.isActive }),
                      promotion.isActive ? 'המבצע הושבת.' : 'המבצע הופעל.',
                    )
                  }
                />
              </div>
            </article>
          ))}
        </section>
      )}

      <AdminFormDialog open={Boolean(dialog)} title={editing ? 'עריכת מבצע' : 'מבצע חדש'} description="מבצע מוצר פשוט שמופיע בהקשר הקטלוג הקיים." message={dialog ? action.message : null} onClose={() => setDialog(null)}>
        <PromotionForm
          key={editing?.id ?? 'new-promotion'}
          promotion={editing}
          products={data.products}
          customers={data.customers}
          routes={data.routes}
          priceLists={data.priceLists}
          categories={data.categories}
          pending={action.pending}
          onCancel={() => setDialog(null)}
          onSubmit={(form) => {
            action.run(
              () => (editing ? updatePromotionAction(readPromotionForm(form, editing.id)) : createPromotionAction(readPromotionForm(form))),
              editing ? 'המבצע עודכן.' : 'המבצע נוצר.',
              () => setDialog(null),
            );
          }}
        />
      </AdminFormDialog>
    </div>
  );
}

export function AdminRecommendationsManager({ data }: { data: RecommendationData }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminStatusFilter>('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [sort, setSort] = useState<RecommendationSort>('updated');
  const action = useCrmAction();
  const editing = dialog?.mode === 'edit' ? data.recommendations.find((recommendation) => recommendation.id === dialog.id) ?? null : null;
  const customerOptions = useMemo(() => getUniqueFilterValues(data.recommendations, (recommendation) => recommendation.customerName), [data.recommendations]);
  const productOptions = useMemo(() => getUniqueFilterValues(data.recommendations, (recommendation) => recommendation.productName), [data.recommendations]);
  const filtered = useMemo(
    () => {
      const searched = filterAdminRecords(data.recommendations, {
        search,
        status,
        getSearchText: (recommendation) => [recommendation.customerName, recommendation.productName, recommendation.reason],
      });
      const byCustomer = filterByValue(searched, customerFilter, (recommendation) => recommendation.customerName);
      const byProduct = filterByValue(byCustomer, productFilter, (recommendation) => recommendation.productName);

      return sortAdminRecords(byProduct, sort, {
        updated: (a, b) => compareNullableDateDesc(a.updatedAt, b.updatedAt),
        customer: (a, b) => compareText(a.customerName, b.customerName) || compareText(a.productName, b.productName),
        product: (a, b) => compareText(a.productName, b.productName) || compareText(a.customerName, b.customerName),
        missingReason: (a, b) => Number(Boolean(a.reason?.trim())) - Number(Boolean(b.reason?.trim())) || compareText(a.customerName, b.customerName),
      });
    },
    [customerFilter, data.recommendations, productFilter, search, sort, status],
  );

  return (
    <div className="space-y-4">
      <AdminCrudPageHeader title="המלצות" description="שיוך ידני של מוצרי אפסייל ללקוחות פעילים." actionLabel="הוסף המלצה" onAction={() => setDialog({ mode: 'create' })} />
      <ActionMessage message={!dialog ? action.message : null} />
      <AdminListToolbar search={search} onSearch={setSearch} status={status} onStatus={setStatus} count={filtered.length} total={data.recommendations.length} searchLabel="חיפוש לפי לקוח, מוצר או סיבה">
        <AdminToolbarSelect label="לקוח" value={customerFilter} onChange={setCustomerFilter} options={[{ value: 'all', label: 'כל הלקוחות' }, ...customerOptions.map((customer) => ({ value: customer, label: customer }))]} />
        <AdminToolbarSelect label="מוצר" value={productFilter} onChange={setProductFilter} options={[{ value: 'all', label: 'כל המוצרים' }, ...productOptions.map((product) => ({ value: product, label: product }))]} />
        <AdminToolbarSelect
          label="מיון"
          value={sort}
          onChange={(value) => setSort(value as RecommendationSort)}
          options={[
            { value: 'updated', label: 'עודכן לאחרונה' },
            { value: 'missingReason', label: 'חסר נימוק' },
            { value: 'customer', label: 'לקוח' },
            { value: 'product', label: 'מוצר' },
          ]}
        />
      </AdminListToolbar>

      {filtered.length === 0 ? (
        <AdminEmptyState title="אין המלצות מתאימות" description="נסה לשנות את החיפוש או את סינון הסטטוס." />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filtered.map((recommendation) => (
            <article key={recommendation.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{recommendation.customerName}</p>
                  <p className="text-xs font-bold text-black/50">{recommendation.productName}</p>
                </div>
                <AdminStatusBadge active={recommendation.isActive} />
              </div>
              <p className="mt-3 rounded-xl bg-[#e6e1d8] p-3 text-sm font-bold text-black/65">{recommendation.reason ?? 'ללא סיבה'}</p>
              <div className="mt-3">
                <AdminActionButtons
                  active={recommendation.isActive}
                  onEdit={() => setDialog({ mode: 'edit', id: recommendation.id })}
                  onToggle={() =>
                    action.run(
                      () => toggleRecommendationActiveAction({ id: recommendation.id, isActive: !recommendation.isActive }),
                      recommendation.isActive ? 'ההמלצה הושבתה.' : 'ההמלצה הופעלה.',
                    )
                  }
                />
              </div>
            </article>
          ))}
        </section>
      )}

      <AdminFormDialog open={Boolean(dialog)} title={editing ? 'עריכת המלצה' : 'המלצה חדשה'} description="שיוך ידני של מוצר מומלץ ללקוח." message={dialog ? action.message : null} onClose={() => setDialog(null)}>
        <RecommendationForm
          key={editing?.id ?? 'new-recommendation'}
          recommendation={editing}
          customers={data.customers}
          products={data.products}
          pending={action.pending}
          onCancel={() => setDialog(null)}
          onSubmit={(form) => {
            action.run(
              () => (editing ? updateRecommendationAction(readRecommendationForm(form, editing.id)) : createRecommendationAction(readRecommendationForm(form))),
              editing ? 'ההמלצה עודכנה.' : 'ההמלצה נשמרה.',
              () => setDialog(null),
            );
          }}
        />
      </AdminFormDialog>
    </div>
  );
}

export function AdminManualOrderClient({ data }: { data: ManualOrderData }) {
  const [customerId, setCustomerId] = useState(data.customers[0]?.id ?? '');
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [productSort, setProductSort] = useState<ManualProductSort>('category');
  const [items, setItems] = useState<Record<string, number>>({});
  const action = useCrmAction();
  const customer = useMemo(() => data.customers.find((item) => item.id === customerId) ?? null, [customerId, data.customers]);
  const selectedItems = customer?.products.filter((product) => (items[product.id] ?? 0) > 0) ?? [];
  const pricing = useMemo(() => getCartPricingSummary(items, customer?.products ?? []), [customer?.products, items]);
  const productCategories = useMemo(() => getUniqueFilterValues(customer?.products ?? [], (product) => product.category), [customer?.products]);
  const visibleProducts = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase();
    const searched = (customer?.products ?? []).filter((product) => {
      if (!normalizedSearch) return true;
      return [product.name, product.sku, product.category, product.caseSize].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
    const categorized = filterByValue(searched, categoryFilter, (product) => product.category);

    return sortAdminRecords(categorized, productSort, {
      name: (a, b) => compareText(a.name, b.name),
      category: (a, b) => compareText(a.category, b.category) || compareText(a.name, b.name),
      priceAsc: (a, b) => compareNumberAsc(a.price, b.price),
      priceDesc: (a, b) => compareNumberDesc(a.price, b.price),
      minQty: (a, b) => compareNumberDesc(a.minQty, b.minQty) || compareText(a.name, b.name),
    });
  }, [categoryFilter, customer?.products, productSearch, productSort]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_1fr]">
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <SectionTitle title="הזמנה ידנית" subtitle="הזמנה אמיתית עם אותו מנגנון מחיר, מינימום ו-Snapshot." />
        {data.customers.length === 0 ? (
          <AdminEmptyState title="אין לקוחות פעילים" description="אין לקוחות פעילים עם קו פעיל להזמנה ידנית." />
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              action.run(
                () =>
                  createManualOrderAction({
                    customerId,
                    intakeChannel: stringValue(form, 'intakeChannel') as 'PHONE' | 'WHATSAPP' | 'ADMIN_MANUAL',
                    notes: stringValue(form, 'notes'),
                    internalNote: stringValue(form, 'internalNote'),
                    items: Object.entries(items)
                      .filter(([, quantity]) => quantity > 0)
                      .map(([productId, quantity]) => ({ productId, quantity })),
                  }),
                'ההזמנה נוצרה.',
                (result) => {
                  const orderId = typeof result.orderId === 'string' ? result.orderId : null;
                  if (orderId) {
                    window.location.href = `/admin/orders/${orderId}`;
                  }
                },
              );
            }}
          >
            <label className="block">
              <span className="text-xs font-black text-black/50">לקוח</span>
              <select
                className={fieldClass}
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setItems({});
                  setProductSearch('');
                  setCategoryFilter('all');
                }}
              >
                {data.customers.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            {customer && (
              <div className="rounded-xl bg-[#e6e1d8] p-3 text-sm font-bold">
                <p>{customer.contact} · {customer.phone}</p>
                <p className="mt-1 text-black/60">קו {customer.routeName} · {customer.priceListName}</p>
                <p className="mt-1 text-black/60">חלוקה {new Intl.DateTimeFormat('he-IL').format(new Date(customer.nextDeliveryAt))}</p>
              </div>
            )}

            <Select name="intakeChannel" label="מקור הזמנה" defaultValue="PHONE" options={[{ value: 'PHONE', label: 'טלפון' }, { value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'ADMIN_MANUAL', label: 'הזנה פנימית' }]} />
            <Textarea name="notes" label="הערה ללקוח" />
            <Textarea name="internalNote" label="הערה פנימית" />
            <div className="rounded-xl border border-black/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-black">סה״כ</span>
                <span className="text-xl font-black tabular-nums">{money(pricing.total)}</span>
              </div>
              {pricing.discountTotal > 0 && (
                <div className="mt-2 flex items-center justify-between gap-3 text-xs font-black text-emerald-700">
                  <span>הנחות</span>
                  <span>-{money(pricing.discountTotal)}</span>
                </div>
              )}
              <p className="mt-1 text-xs font-bold text-black/45">{selectedItems.length} שורות בהזמנה</p>
              {selectedItems.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-black/10 pt-3">
                  {selectedItems.slice(0, 3).map((product) => (
                    <p key={product.id} className="flex items-center justify-between gap-3 text-xs font-black text-black/60">
                      <span className="truncate">{product.name}</span>
                      <span className="shrink-0 tabular-nums">×{items[product.id]}</span>
                    </p>
                  ))}
                  {selectedItems.length > 3 && <p className="text-xs font-black text-black/45">ועוד {selectedItems.length - 3} מוצרים</p>}
                </div>
              )}
            </div>
            {selectedItems.length > 0 && (
              <button type="button" className="min-h-10 w-full rounded-full bg-[#e6e1d8] px-4 text-sm font-black hover:bg-black hover:text-white" onClick={() => setItems({})}>
                נקה כמויות
              </button>
            )}
            <SubmitButton pending={action.pending} label="יצירת הזמנה" icon={<ShoppingCart size={16} />} />
          </form>
        )}
        <ActionMessage message={action.message} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_54px_rgba(0,0,0,0.05)]">
        <TableHeader title="מוצרים להזמנה" count={visibleProducts.length} />
        {customer && (
          <div className="grid gap-2 border-b border-black/10 p-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
            <label className="block">
              <span className="sr-only">חיפוש מוצר</span>
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="חיפוש מוצר, SKU או מארז"
                className={`${fieldClass} mt-0 bg-[#f7f5f1]`}
              />
            </label>
            <AdminToolbarSelect label="קטגוריה" value={categoryFilter} onChange={setCategoryFilter} options={[{ value: 'all', label: 'כל הקטגוריות' }, ...productCategories.map((category) => ({ value: category, label: category }))]} />
            <AdminToolbarSelect
              label="מיון"
              value={productSort}
              onChange={(value) => setProductSort(value as ManualProductSort)}
              options={[
                { value: 'category', label: 'קטגוריה' },
                { value: 'name', label: 'שם מוצר' },
                { value: 'priceAsc', label: 'מחיר נמוך' },
                { value: 'priceDesc', label: 'מחיר גבוה' },
                { value: 'minQty', label: 'מינימום גבוה' },
              ]}
            />
          </div>
        )}
        <div className="divide-y divide-black/10">
          {!customer ? (
            <p className="p-4 text-sm font-bold text-black/45">בחר לקוח כדי לראות מוצרים.</p>
          ) : visibleProducts.length === 0 ? (
            <p className="p-4 text-sm font-bold text-black/45">אין מוצרים שמתאימים לחיפוש או לסינון.</p>
          ) : (
            visibleProducts.map((product) => (
              <div key={product.id} className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_7rem_7rem_7rem] lg:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <ProductThumbnail name={product.name} assetImage={product.assetImage} imageUrl={product.imageUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{product.name}</p>
                    <p className="truncate text-xs font-bold text-black/50">{product.sku} / {product.category} / {product.caseSize}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-[#e6e1d8] p-2">
                  <p className="text-[11px] font-black text-black/45">מחיר</p>
                  {product.listPrice > product.price && <p className="text-[11px] font-bold text-black/40 line-through">{money(product.listPrice)}</p>}
                  <p className="mt-0.5 text-sm font-black tabular-nums">{money(product.price)}</p>
                  {product.promoLabel && <p className="mt-1 w-fit rounded-full bg-black px-1.5 py-0.5 text-[10px] font-black text-white">{product.promoLabel}</p>}
                </div>
                <SmallStack label="מינימום" value={String(product.minQty)} />
                <input
                  aria-label={`כמות ${product.name}`}
                  className={`${fieldClass} text-center tabular-nums`}
                  type="number"
                  min={0}
                  step={1}
                  value={items[product.id] ?? 0}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setItems((current) => ({ ...current, [product.id]: Number.isFinite(next) ? next : 0 }));
                  }}
                />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function CustomerForm({
  customer,
  routes,
  priceLists,
  pending,
  onSubmit,
  onCancel,
}: {
  customer: CustomerData['customers'][number] | null;
  routes: CustomerData['routes'];
  priceLists: CustomerData['priceLists'];
  pending: boolean;
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <FormShell onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="name" label="שם עסק" defaultValue={customer?.name} required />
        <Input name="contact" label="איש קשר" defaultValue={customer?.contact} required />
        <Input name="email" label="אימייל" defaultValue={customer?.email ?? ''} />
        <Input name="phone" label="טלפון" defaultValue={customer?.phone} required />
        <Input name="region" label="אזור" defaultValue={customer?.region} required />
        <Input name="address" label="כתובת" defaultValue={customer?.address} required />
        <Select name="routeId" label="קו" defaultValue={customer?.routeId} options={routes.map((route) => ({ value: route.id, label: `${route.name}${route.isActive ? '' : ' (לא פעיל)'}` }))} />
        <Select name="priceListId" label="מחירון" defaultValue={customer?.priceListId} options={priceLists.map((priceList) => ({ value: priceList.id, label: `${priceList.name}${priceList.isDefault ? ' · ברירת מחדל' : ''}` }))} />
      </div>
      <Input name="statusLabel" label="סטטוס פנימי" defaultValue={customer?.statusLabel ?? ''} />
      <Textarea name="notes" label="הערות" defaultValue={customer?.notes ?? ''} />
      <div className="grid gap-2 md:grid-cols-3">
        <Checkbox name="isActive" label="פעיל" defaultChecked={customer?.isActive ?? true} />
        <Checkbox name="emailEnabled" label="התראות אימייל" defaultChecked={customer?.emailEnabled ?? true} />
        <Checkbox name="whatsappEnabled" label="התראות WhatsApp" defaultChecked={customer?.whatsappEnabled ?? false} />
      </div>
      <FormActions pending={pending} onCancel={onCancel} />
    </FormShell>
  );
}

function ProductForm({
  product,
  priceLists,
  pending,
  onSubmit,
  onCancel,
}: {
  product: ProductData['products'][number] | null;
  priceLists: ProductData['priceLists'];
  pending: boolean;
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
}) {
  const pricesByPriceListId = new Map(product?.prices.map((item) => [item.priceListId, item.price]) ?? []);

  return (
    <FormShell onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="sku" label="SKU" defaultValue={product?.sku} required />
        <Input name="name" label="שם מוצר" defaultValue={product?.name} required />
        <Input name="category" label="קטגוריה" defaultValue={product?.category} required />
        <Input name="basePrice" label="מחיר בסיס" defaultValue={product?.basePrice ?? 1} type="number" required />
        <Input name="unit" label="יחידה" defaultValue={product?.unit ?? 'יח׳'} required />
        <Input name="caseSize" label="גודל מארז" defaultValue={product?.caseSize ?? '1'} required />
        <Input name="minQty" label="כמות מינימום" defaultValue={product?.minQty ?? 1} type="number" required />
        <Input name="stockLabel" label="סטטוס מלאי" defaultValue={product?.stockLabel ?? ''} />
        <Input name="imageUrl" label="Image URL" defaultValue={product?.imageUrl ?? ''} />
        <Input name="assetImage" label="Asset image" defaultValue={product?.assetImage ?? ''} />
      </div>
      <Textarea name="description" label="תיאור" defaultValue={product?.description ?? ''} />
      <section className="rounded-2xl border border-black/10 p-3">
        <p className="text-sm font-black">מחירים לפי מחירון</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {priceLists.map((priceList) => (
            <Input key={priceList.id} name={`priceList:${priceList.id}`} label={`${priceList.name}${priceList.isDefault ? ' · ברירת מחדל' : ''}`} defaultValue={pricesByPriceListId.get(priceList.id) ?? product?.basePrice ?? 1} type="number" required />
          ))}
        </div>
      </section>
      <Checkbox name="isActive" label="פעיל" defaultChecked={product?.isActive ?? true} />
      <FormActions pending={pending} onCancel={onCancel} />
    </FormShell>
  );
}

function PriceListForm({
  priceList,
  products,
  pending,
  onSubmit,
  onCancel,
}: {
  priceList: PriceListData['priceLists'][number] | null;
  products: PriceListData['products'];
  pending: boolean;
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
}) {
  const pricesByProductId = new Map(priceList?.items.map((item) => [item.productId, item.price]) ?? []);

  return (
    <FormShell onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="name" label="שם מחירון" defaultValue={priceList?.name} required />
        <Input name="description" label="תיאור" defaultValue={priceList?.description ?? ''} />
      </div>
      <Checkbox name="isDefault" label="ברירת מחדל" defaultChecked={priceList?.isDefault ?? false} />
      <section className="overflow-hidden rounded-2xl border border-black/10">
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2 bg-[#e6e1d8] px-3 py-2 text-xs font-black text-black/55">
          <span>מוצר</span>
          <span className="text-left">מחיר</span>
        </div>
        <div className="max-h-[42vh] divide-y divide-black/10 overflow-y-auto">
          {products.map((product) => (
            <label key={product.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{product.name}</span>
                <span className="block truncate text-[11px] font-bold text-black/45">{product.sku} · {product.category}</span>
              </span>
              <input name={`price:${product.id}`} type="number" min="0.01" step="0.01" defaultValue={pricesByProductId.get(product.id) ?? product.basePrice} className="w-full rounded-xl border border-black/10 bg-white px-2 py-2 text-left text-sm font-black tabular-nums outline-none focus:ring-2 focus:ring-black/20" />
            </label>
          ))}
        </div>
      </section>
      <FormActions pending={pending} onCancel={onCancel} />
    </FormShell>
  );
}

function ClonePriceListForm({ source, pending, onSubmit, onCancel }: { source: PriceListData['priceLists'][number]; pending: boolean; onSubmit: (form: FormData) => void; onCancel: () => void }) {
  return (
    <FormShell onSubmit={onSubmit}>
      <Input name="name" label="שם מחירון חדש" defaultValue={`${source.name} - העתק`} required />
      <div className="rounded-2xl bg-[#e6e1d8] p-3 text-sm font-bold text-black/65">
        {source.items.length} מחירי מוצרים יועתקו מהמחירון המקורי.
      </div>
      <FormActions pending={pending} onCancel={onCancel} />
    </FormShell>
  );
}

function RouteForm({ route, pending, onSubmit, onCancel }: { route: RouteData['routes'][number] | null; pending: boolean; onSubmit: (form: FormData) => void; onCancel: () => void }) {
  return (
    <FormShell onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="name" label="שם קו" defaultValue={route?.name} required />
        <Input name="region" label="אזור" defaultValue={route?.region} required />
        <Input name="driver" label="נהג" defaultValue={route?.driver ?? ''} />
        <Input name="opsContactName" label="איש קשר תפעולי" defaultValue={route?.opsContactName ?? ''} />
        <Input name="opsContactPhone" label="טלפון תפעולי" defaultValue={route?.opsContactPhone ?? ''} />
        <Input name="deliveryWeekday" label="יום חלוקה 0-6" defaultValue={route?.deliveryWeekday ?? 2} type="number" required />
        <Input name="cutoffWeekday" label="יום דדליין 0-6" defaultValue={route?.cutoffWeekday ?? 1} type="number" required />
        <Input name="cutoffTime" label="שעת דדליין" defaultValue={route?.cutoffTime ?? '18:00'} required />
        <Input name="nextDeliveryAt" label="חלוקה קרובה" defaultValue={toDateTimeLocal(route?.nextDeliveryAt)} type="datetime-local" required />
        <Input name="nextCutoffAt" label="דדליין קרוב" defaultValue={toDateTimeLocal(route?.nextCutoffAt)} type="datetime-local" required />
      </div>
      <Checkbox name="isActive" label="פעיל" defaultChecked={route?.isActive ?? true} />
      <FormActions pending={pending} onCancel={onCancel} />
    </FormShell>
  );
}

function PromotionForm({
  promotion,
  products,
  customers,
  routes,
  priceLists,
  categories,
  pending,
  onSubmit,
  onCancel,
}: {
  promotion: PromotionData['promotions'][number] | null;
  products: PromotionData['products'];
  customers: PromotionData['customers'];
  routes: PromotionData['routes'];
  priceLists: PromotionData['priceLists'];
  categories: PromotionData['categories'];
  pending: boolean;
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
}) {
  const selectedProductIds = promotion?.productIds ?? [];
  const selectedCategories = promotion?.categories ?? [];
  const selectedCustomerIds = promotion?.customerIds ?? [];
  const selectedRouteIds = promotion?.routeIds ?? [];
  const selectedPriceListIds = promotion?.priceListIds ?? [];

  return (
    <FormShell onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Input name="title" label="כותרת" defaultValue={promotion?.title} required />
        <Input name="tag" label="תג" defaultValue={promotion?.tag} required />
        <Select
          name="effectType"
          label="סוג מבצע"
          defaultValue={promotion?.effectType ?? 'DISPLAY_ONLY'}
          options={[
            { value: 'DISPLAY_ONLY', label: 'תג בלבד' },
            { value: 'PERCENT_OFF', label: 'אחוז הנחה' },
            { value: 'FIXED_AMOUNT_OFF', label: 'סכום הנחה ליחידה' },
            { value: 'FIXED_UNIT_PRICE', label: 'מחיר יחידה קבוע' },
            { value: 'BUY_X_GET_Y', label: 'קנה X קבל Y' },
          ]}
        />
        <Input name="discountValue" label="ערך הנחה / מחיר" defaultValue={promotion?.discountValue ?? ''} type="number" />
        <Input name="buyQuantity" label="קנה כמות" defaultValue={promotion?.buyQuantity ?? ''} type="number" />
        <Input name="freeQuantity" label="קבל ללא חיוב" defaultValue={promotion?.freeQuantity ?? ''} type="number" />
        <Input name="priority" label="עדיפות" defaultValue={promotion?.priority ?? 0} type="number" required />
        <Input name="startsAt" label="מתאריך" defaultValue={toDateTimeLocal(promotion?.startsAt)} type="datetime-local" />
        <Input name="endsAt" label="עד תאריך" defaultValue={toDateTimeLocal(promotion?.endsAt)} type="datetime-local" />
      </div>
      <Textarea name="description" label="תיאור" defaultValue={promotion?.description ?? ''} required />
      <div className="grid gap-3 lg:grid-cols-2">
        <CheckboxGroup title="מוצרים" name="productIds" options={products.map((product) => ({ value: product.id, label: `${product.name} · ${product.sku}${product.isActive ? '' : ' (לא פעיל)'}` }))} selected={selectedProductIds} />
        <CheckboxGroup title="קטגוריות" name="categories" options={categories.map((category) => ({ value: category, label: category }))} selected={selectedCategories} />
        <CheckboxGroup title="לקוחות" name="customerIds" options={customers.map((customer) => ({ value: customer.id, label: customer.name }))} selected={selectedCustomerIds} />
        <CheckboxGroup title="קווים" name="routeIds" options={routes.map((route) => ({ value: route.id, label: route.name }))} selected={selectedRouteIds} />
        <CheckboxGroup title="מחירונים" name="priceListIds" options={priceLists.map((priceList) => ({ value: priceList.id, label: `${priceList.name}${priceList.isDefault ? ' · ברירת מחדל' : ''}` }))} selected={selectedPriceListIds} />
      </div>
      <Checkbox name="isActive" label="פעיל" defaultChecked={promotion?.isActive ?? true} />
      <FormActions pending={pending} onCancel={onCancel} />
    </FormShell>
  );
}

function RecommendationForm({ recommendation, customers, products, pending, onSubmit, onCancel }: { recommendation: RecommendationData['recommendations'][number] | null; customers: RecommendationData['customers']; products: RecommendationData['products']; pending: boolean; onSubmit: (form: FormData) => void; onCancel: () => void }) {
  return (
    <FormShell onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Select name="customerId" label="לקוח" defaultValue={recommendation?.customerId} options={customers.map((customer) => ({ value: customer.id, label: customer.name }))} />
        <Select name="productId" label="מוצר" defaultValue={recommendation?.productId} options={products.map((product) => ({ value: product.id, label: `${product.name} · ${product.sku}` }))} />
      </div>
      <Textarea name="reason" label="סיבה" defaultValue={recommendation?.reason ?? ''} />
      <Checkbox name="isActive" label="פעיל" defaultChecked={recommendation?.isActive ?? true} />
      <FormActions pending={pending} onCancel={onCancel} />
    </FormShell>
  );
}

function ProductThumbnail({
  name,
  assetImage,
  imageUrl,
  variant = 'thumb',
}: {
  name: string;
  assetImage?: string | null;
  imageUrl?: string | null;
  variant?: 'thumb' | 'card';
}) {
  const thumbnail = resolveProductThumbnail({
    name,
    assetImage,
    imageUrl,
    knownAssets: new Set(Object.keys(productImages)),
  });
  const isCard = variant === 'card';
  const frameClass = isCard
    ? 'relative aspect-[4/3] w-full overflow-hidden bg-[#e6e1d8]'
    : 'relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#e6e1d8]';
  const imageClass = isCard ? 'object-cover transition duration-300 group-hover:scale-[1.03]' : 'object-cover';

  if (thumbnail.type === 'asset') {
    return (
      <div className={frameClass}>
        <Image src={productImages[thumbnail.assetKey]} alt={name} fill sizes={isCard ? '(max-width: 640px) 100vw, (max-width: 1536px) 50vw, 33vw' : '96px'} className={imageClass} />
      </div>
    );
  }

  if (thumbnail.type === 'url') {
    return (
      <div className={frameClass}>
        <img src={thumbnail.src} alt={name} className={`h-full w-full ${imageClass}`} />
      </div>
    );
  }

  return (
    <div className={`${isCard ? 'aspect-[4/3] w-full' : 'h-24 w-24 shrink-0 rounded-xl'} grid place-items-center bg-[#e6e1d8] text-black/55`}>
      <div className="text-center">
        <Package className="mx-auto" size={isCard ? 32 : 22} />
        <p className="mt-1 text-sm font-black">{thumbnail.initials}</p>
      </div>
    </div>
  );
}

function useCrmAction() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run<T extends Record<string, unknown>>(call: () => Promise<ActionResult<T>>, success: string, after?: (data: T) => void) {
    startTransition(async () => {
      const result = await call();
      if (result.ok) {
        setMessage(success);
        router.refresh();
        after?.(result.data);
      } else {
        setMessage(result.error);
      }
    });
  }

  return { message, pending, run };
}

function readCustomerForm(form: FormData, id?: string) {
  return {
    ...(id ? { id } : {}),
    name: stringValue(form, 'name'),
    contact: stringValue(form, 'contact'),
    email: stringValue(form, 'email'),
    phone: stringValue(form, 'phone'),
    region: stringValue(form, 'region'),
    address: stringValue(form, 'address'),
    routeId: stringValue(form, 'routeId'),
    priceListId: stringValue(form, 'priceListId'),
    notes: stringValue(form, 'notes'),
    statusLabel: stringValue(form, 'statusLabel'),
    isActive: checkboxValue(form, 'isActive'),
    emailEnabled: checkboxValue(form, 'emailEnabled'),
    whatsappEnabled: checkboxValue(form, 'whatsappEnabled'),
  };
}

function readProductForm(form: FormData, priceLists: ProductData['priceLists'], id?: string) {
  return {
    ...(id ? { id } : {}),
    sku: stringValue(form, 'sku'),
    name: stringValue(form, 'name'),
    category: stringValue(form, 'category'),
    description: stringValue(form, 'description'),
    basePrice: numberValue(form, 'basePrice'),
    unit: stringValue(form, 'unit'),
    caseSize: stringValue(form, 'caseSize'),
    minQty: numberValue(form, 'minQty'),
    imageUrl: stringValue(form, 'imageUrl'),
    assetImage: stringValue(form, 'assetImage'),
    stockLabel: stringValue(form, 'stockLabel'),
    isActive: checkboxValue(form, 'isActive'),
    prices: priceLists.map((priceList) => ({
      priceListId: priceList.id,
      price: numberValue(form, `priceList:${priceList.id}`),
    })),
  };
}

function readPriceListForm(form: FormData, products: PriceListData['products'], id?: string) {
  return {
    ...(id ? { id } : {}),
    name: stringValue(form, 'name'),
    description: stringValue(form, 'description'),
    isDefault: checkboxValue(form, 'isDefault'),
    prices: products.map((product) => ({
      productId: product.id,
      price: numberValue(form, `price:${product.id}`),
    })),
  };
}

function readRouteForm(form: FormData, id?: string) {
  return {
    ...(id ? { id } : {}),
    name: stringValue(form, 'name'),
    region: stringValue(form, 'region'),
    driver: stringValue(form, 'driver'),
    opsContactName: stringValue(form, 'opsContactName'),
    opsContactPhone: stringValue(form, 'opsContactPhone'),
    deliveryWeekday: numberValue(form, 'deliveryWeekday'),
    cutoffWeekday: numberValue(form, 'cutoffWeekday'),
    cutoffTime: stringValue(form, 'cutoffTime'),
    nextDeliveryAt: stringValue(form, 'nextDeliveryAt'),
    nextCutoffAt: stringValue(form, 'nextCutoffAt'),
    isActive: checkboxValue(form, 'isActive'),
  };
}

function readPromotionForm(form: FormData, id?: string) {
  const productIds = multiValue(form, 'productIds');

  return {
    ...(id ? { id } : {}),
    title: stringValue(form, 'title'),
    tag: stringValue(form, 'tag'),
    description: stringValue(form, 'description'),
    productId: productIds[0] ?? '',
    effectType: stringValue(form, 'effectType'),
    discountValue: stringValue(form, 'discountValue'),
    buyQuantity: stringValue(form, 'buyQuantity'),
    freeQuantity: stringValue(form, 'freeQuantity'),
    priority: numberValue(form, 'priority'),
    productIds,
    categories: multiValue(form, 'categories'),
    customerIds: multiValue(form, 'customerIds'),
    routeIds: multiValue(form, 'routeIds'),
    priceListIds: multiValue(form, 'priceListIds'),
    startsAt: stringValue(form, 'startsAt'),
    endsAt: stringValue(form, 'endsAt'),
    isActive: checkboxValue(form, 'isActive'),
  };
}

function readRecommendationForm(form: FormData, id?: string) {
  return {
    ...(id ? { id } : {}),
    customerId: stringValue(form, 'customerId'),
    productId: stringValue(form, 'productId'),
    reason: stringValue(form, 'reason'),
    isActive: checkboxValue(form, 'isActive'),
  };
}

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: (form: FormData) => void }) {
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      {children}
    </form>
  );
}

function FormActions({ pending, onCancel }: { pending: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-black/10 pt-3">
      <SubmitButton pending={pending} label="שמירה" icon={<Save size={16} />} />
      <button type="button" className="min-h-10 rounded-full bg-[#e6e1d8] px-4 text-sm font-black hover:bg-black hover:text-white" onClick={onCancel}>
        ביטול
      </button>
    </div>
  );
}

function SubmitButton({ pending, label, icon }: { pending: boolean; label: string; icon: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white disabled:opacity-45">
      {pending ? <Check size={16} /> : icon}
      {pending ? 'שומר...' : label}
    </button>
  );
}

function Input({ name, label, defaultValue = '', type = 'text', required = false }: { name: string; label: string; defaultValue?: string | number | null; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-black/50">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue ?? ''} className={fieldClass} />
    </label>
  );
}

function Textarea({ name, label, defaultValue = '', required = false }: { name: string; label: string; defaultValue?: string | null; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-black/50">{label}</span>
      <textarea name={name} required={required} defaultValue={defaultValue ?? ''} rows={3} className={`${fieldClass} min-h-24 resize-y`} />
    </label>
  );
}

function Select({ name, label, defaultValue, options }: { name: string; label: string; defaultValue?: string | null; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-black/50">{label}</span>
      <select name={name} required defaultValue={defaultValue ?? options[0]?.value ?? ''} className={fieldClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm font-black">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-black" />
      {label}
    </label>
  );
}

function CheckboxGroup({ title, name, options, selected }: { title: string; name: string; options: { value: string; label: string }[]; selected: string[] }) {
  const selectedSet = new Set(selected);

  return (
    <section className="rounded-2xl border border-black/10 p-3">
      <p className="text-sm font-black">{title}</p>
      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
        {options.length === 0 ? (
          <p className="text-xs font-bold text-black/45">אין אפשרויות</p>
        ) : (
          options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 rounded-xl px-2 py-1 text-xs font-bold hover:bg-[#e6e1d8]">
              <input name={name} type="checkbox" value={option.value} defaultChecked={selectedSet.has(option.value)} className="h-4 w-4 accent-black" />
              <span className="min-w-0 truncate">{option.label}</span>
            </label>
          ))
        )}
      </div>
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-1 text-sm font-bold leading-6 text-black/55">{subtitle}</p>
    </div>
  );
}

function TableHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
      <h2 className="text-base font-black">{title}</h2>
      <span className="rounded-full bg-[#e6e1d8] px-2 py-1 text-xs font-black text-black/60">{count}</span>
    </div>
  );
}

function SmallStack({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-black text-black/45">{label}</p>
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#e6e1d8] px-3 py-2">
      <p className="text-[11px] font-black text-black/45">{label}</p>
      <p className="truncate text-sm font-black tabular-nums">{value}</p>
    </div>
  );
}

function ActionMessage({ message }: { message: string | null }) {
  if (!message) return null;

  return <p className="rounded-xl border border-black/10 bg-[#e6e1d8] p-3 text-sm font-black">{message}</p>;
}

function stringValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function numberValue(form: FormData, name: string): number {
  return Number(stringValue(form, name));
}

function checkboxValue(form: FormData, name: string): boolean {
  return form.get(name) === 'on';
}

function multiValue(form: FormData, name: string): string[] {
  return form
    .getAll(name)
    .map((value) => (typeof value === 'string' ? value : ''))
    .filter(Boolean);
}

function toDateTimeLocal(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}

function formatRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'ללא הגבלה';
  const formatter = new Intl.DateTimeFormat('he-IL');
  if (start && end) return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
  return start ? `מ-${formatter.format(new Date(start))}` : `עד ${formatter.format(new Date(end as string))}`;
}

function formatPromotionEffect(promotion: PromotionData['promotions'][number]): string {
  if (promotion.effectType === 'DISPLAY_ONLY') return 'תג בלבד';
  if (promotion.effectType === 'PERCENT_OFF') return `${promotion.discountValue ?? 0}%`;
  if (promotion.effectType === 'FIXED_AMOUNT_OFF') return `${money(promotion.discountValue ?? 0)} הנחה`;
  if (promotion.effectType === 'FIXED_UNIT_PRICE') return `${money(promotion.discountValue ?? 0)} ליחידה`;
  return `${promotion.buyQuantity ?? 0}+${promotion.freeQuantity ?? 0}`;
}

function promotionMatchesWindow(start: string | null | undefined, end: string | null | undefined, filter: PromotionWindowFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return !start && !end;

  const now = Date.now();
  const startsAt = start ? new Date(start).getTime() : Number.NEGATIVE_INFINITY;
  const endsAt = end ? new Date(end).getTime() : Number.POSITIVE_INFINITY;

  if (filter === 'running') return startsAt <= now && now <= endsAt;
  if (filter === 'upcoming') return startsAt > now;
  return endsAt < now;
}

function orderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'טיוטה',
    SUBMITTED: 'התקבל',
    SPECIAL_REQUEST: 'בקשה מיוחדת',
    APPROVED: 'מאושר',
    PACKED: 'ארוז',
    DELIVERED: 'סופק',
    CANCELLED: 'בוטל',
  };

  return labels[status] ?? status;
}

const fieldClass = 'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-black focus:ring-2 focus:ring-black/10';
