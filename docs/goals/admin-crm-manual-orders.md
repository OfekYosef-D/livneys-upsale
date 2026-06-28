# Admin CRM Core Management + Manual Order Creation Implementation Brief

## Goal

Implement the next production vertical slice for the Livney's B2B Reorder & Upsell platform: an admin CRM layer for managing core operating data and creating real manual orders for customers who still order by phone, WhatsApp, or internal admin handling.

This brief is for implementation only. Do not use it as permission to build unrelated admin systems, notification automation, exports, payments, inventory, or billing.

## Example Brief Assessment

Rating: 8/10.

The example is directionally strong: it names the business outcome, keeps manual orders tied to the existing order snapshot rules, requires server-side authorization, and calls out Zod validation and soft deletes.

Refinements needed before implementation:

- Ground the scope in the current Prisma schema instead of saying "if available" without decisions.
- The current `OrderSource` enum only supports `CUSTOMER` and `ADMIN`; `PHONE`, `WHATSAPP`, and `ADMIN_MANUAL` are not modeled.
- Promotion route/customer targeting is not modeled today; customer-specific upsell support exists through `CustomerProductRecommendation`.
- Customer email changes can affect Auth.js login data because `Customer.email` and linked `User.email` are separate fields.
- Product creation must consider `PriceListItem`; otherwise new products may not appear in customer catalogs or manual order pricing.
- Existing order write-context logic is private to `features/customer-portal/actions.ts`; this slice should extract reusable order creation logic rather than copy it.

## Current Production Foundation

The repository already has the first production foundation in place:

- Next.js App Router, React, TypeScript, Tailwind, Prisma, Postgres, Auth.js, Zod, and Vitest.
- Root layout is Hebrew RTL: `app/layout.tsx` sets `lang="he"` and `dir="rtl"`.
- Modular code exists under `features/`.
- Admin pages are guarded with `requireAdmin` from `lib/admin-guard.ts`.
- Customer actions are guarded with `assertCustomerAction` from `lib/authorization.ts`.
- Server action result helpers exist in `lib/action-result.ts`.
- Customer order submission exists in `features/customer-portal/actions.ts`.
- Order snapshot logic exists in `features/orders/utils.ts`.
- Pricing helper logic exists in `features/pricing/utils.ts`.
- Admin dashboard/order/route/customer read views exist in `features/admin/queries.ts` and `features/admin/components/`.
- `app/admin/manual-order/page.tsx` currently exists as a guarded placeholder.

Important current schema facts:

- `Customer` has `name`, `contact`, `email`, `phone`, `region`, `address`, `notes`, `statusLabel`, `isActive`, `routeId`, `priceListId`, `notificationPreference`, recommendations, orders, and contact logs.
- `Product` has `sku`, `name`, `category`, `basePrice`, `unit`, `caseSize`, `minQty`, `imageUrl`, `assetImage`, `stockLabel`, `description`, and `isActive`.
- `Route` has `name`, `region`, `driver`, ops contact fields, delivery/cutoff weekday fields, cutoff time, next delivery/cutoff dates, and `isActive`.
- `Promotion` supports product-level promotions only: title, tag, description, product, optional dates, and active status.
- `CustomerProductRecommendation` supports customer/product recommendations with reason and active status.
- `OrderSource` is currently `CUSTOMER | ADMIN`.
- `NotificationChannel` is currently `EMAIL | WHATSAPP`, not phone.

## Scope

Build the admin CRM core needed to operate the B2B reorder system:

- Admin customer management.
- Admin product management.
- Admin route management.
- Admin promotion and recommendation management.
- Admin manual order creation using the same pricing and snapshot rules as customer-submitted orders.

The slice should make operational data manageable without changing the customer reorder UX except where shared order/pricing logic is refactored safely.

## Out of Scope

Do not implement these in this slice:

- Reminder scheduling or sending.
- WhatsApp API integration.
- Email delivery.
- CSV import/export.
- Vercel Blob uploads or image upload workflows.
- Inventory management.
- Payments.
- Tax or billing.
- Complex recommendation engine.
- Hard deletes for operational records.
- Full price-list management unless required to keep product creation orderable.
- Password reset, invitation, or full customer account lifecycle unless explicitly needed for safe customer create/edit behavior.

## Required Features

### 1. Admin Customers Management

Admin must be able to:

- View customers in a searchable or scannable list.
- Create a customer.
- Edit customer details.
- Activate/deactivate customers with `isActive`; never hard delete customers.
- View customer route, price list, notification preference, recommendations, and recent order context where useful.

Customer fields for create/edit:

- Business name: maps to `Customer.name`.
- Contact name: maps to `Customer.contact`.
- Email: maps to `Customer.email`; handle linked `User.email` safely.
- Phone: maps to `Customer.phone`.
- Region: maps to `Customer.region`.
- Address: maps to `Customer.address`.
- Route: maps to `Customer.routeId`.
- Price list: maps to `Customer.priceListId`.
- Notes: maps to `Customer.notes`.
- Status label if useful: maps to `Customer.statusLabel`.
- Active status: maps to `Customer.isActive`.
- Notification preferences: maps to `NotificationPreference.emailEnabled` and `NotificationPreference.whatsappEnabled`.

Customer auth/account rule:

- Do not silently desynchronize customer CRM email and login email.
- If editing `Customer.email` for a customer with a linked `User`, update `User.email` in the same transaction or block the change with a clear admin-facing error.
- If creating a new customer, only create a linked `User` if the implementation defines a valid credential strategy. Do not create unusable login accounts with unknown passwords.

### 2. Admin Products Management

Admin must be able to:

- View products.
- Create products.
- Edit products.
- Activate/deactivate products with `isActive`; never hard delete products.

Product fields for create/edit:

- Name: `Product.name`.
- SKU: `Product.sku`.
- Category: `Product.category`.
- Description: `Product.description`.
- Base price: `Product.basePrice`.
- Unit: `Product.unit`.
- Case size: `Product.caseSize`.
- Minimum quantity: `Product.minQty`.
- Image URL: `Product.imageUrl`.
- Existing asset image if needed: `Product.assetImage`.
- Stock label if useful: `Product.stockLabel`.
- Active status: `Product.isActive`.

Pricing and catalog rule:

- Product create/edit must not break customer catalog or manual order pricing.
- If a new product should be orderable immediately, create or update at least the default `PriceListItem` using the product base price.
- If this slice does not build full price-list editing, document the limitation in the implementation summary and keep behavior explicit in the UI.
- Existing historical `OrderLine` snapshots must remain unchanged when product details or prices are edited.

### 3. Admin Routes Management

Admin must be able to:

- View routes.
- Create routes.
- Edit routes.
- Activate/deactivate routes with `isActive`; never hard delete routes.

Route fields for create/edit:

- Name: `Route.name`.
- Region: `Route.region`.
- Driver if useful: `Route.driver`.
- Delivery weekday: `Route.deliveryWeekday`.
- Cutoff weekday: `Route.cutoffWeekday`.
- Cutoff time: `Route.cutoffTime`.
- Next delivery date/time: `Route.nextDeliveryAt`.
- Next cutoff date/time: `Route.nextCutoffAt`.
- Ops contact name: `Route.opsContactName`.
- Ops contact phone: `Route.opsContactPhone`.
- Active status: `Route.isActive`.

Safety rules:

- Deactivating a route must not delete customers or orders.
- Creating or editing customers should not assign them to inactive routes unless the UI explicitly supports exceptional admin workflows.
- Manual order creation should reject inactive routes through the selected customer context.

### 4. Admin Promotions And Recommendations

Admin must be able to:

- View promotions.
- Create promotions.
- Edit promotions.
- Activate/deactivate promotions with `isActive`.
- Manage simple customer product recommendations where `CustomerProductRecommendation` supports it.

Promotion fields for create/edit:

- Title: `Promotion.title`.
- Tag: `Promotion.tag`.
- Description: `Promotion.description`.
- Related product: `Promotion.productId`.
- Start date: `Promotion.startsAt`.
- End date: `Promotion.endsAt`.
- Active status: `Promotion.isActive`.

Recommendation fields for create/edit:

- Customer: `CustomerProductRecommendation.customerId`.
- Product: `CustomerProductRecommendation.productId`.
- Reason: `CustomerProductRecommendation.reason`.
- Active status: `CustomerProductRecommendation.isActive`.

Targeting rule:

- Do not implement route/customer promotion targeting in this slice because the current `Promotion` model does not support it.
- Customer-specific upsell should use `CustomerProductRecommendation`.
- Do not build a recommendation engine. This is manual CRM curation only.

### 5. Manual Order Creation

Replace `app/admin/manual-order/page.tsx` placeholder with a real admin workflow.

Admin must be able to:

- Select an active customer.
- See customer route, next delivery/cutoff, price list, and contact context.
- Search or browse active products available to that customer.
- Add products to an order.
- Change quantities.
- Enforce product minimum quantities.
- Add customer-visible notes: `Order.notes`.
- Add internal admin notes if needed: `Order.internalNote`.
- Select intake channel in the UI: phone, WhatsApp, or admin manual.
- Submit the order.
- See the created order in existing admin dashboard, order detail, route detail, and customer detail views where status filters include it.

Order source persistence:

- Current schema only supports `OrderSource.ADMIN` for manual orders.
- Save manual orders with `Order.source = ADMIN`.
- Capture the intake channel as structured text in `Order.internalNote` unless this implementation deliberately adds a reviewed schema migration for a dedicated field.
- Do not add `PHONE`, `WHATSAPP`, or `ADMIN_MANUAL` enum values casually. If a migration is added, update tests, seed data, and all source displays.

Manual order business rules:

- Manual orders are real submitted orders, not drafts, unless the implementation explicitly adds a draft manual order UX.
- Use `Order.status = SUBMITTED` before cutoff and `SPECIAL_REQUEST` after cutoff, matching `getSubmissionStatus`.
- Use the customer's current route for `routeId`, `deliveryWindowStart`, and `deadlineAt`.
- Set `submittedAt` to the server time when the admin submits the order.
- Do not trust client-sent price, product name, line total, route, deadline, or delivery window values.
- Use the same price resolution and order line snapshot rules as customer-submitted orders.
- Inactive customers, inactive routes, inactive products, products outside the customer's price context, empty orders, and below-minimum quantities must be rejected.

## Architecture Rules

Follow `AGENTS.md` exactly:

- Use modular feature architecture under `features/`.
- Pages should only load data, render UI, and call server actions.
- Business logic belongs in feature modules, not page components.
- Validate all server actions and forms with Zod.
- Enforce admin/customer permissions server-side.
- Preserve Hebrew RTL UI behavior and copy direction.
- Preserve existing UI/UX direction unless a production requirement forces a focused change.
- Keep the app buildable after each major implementation step.
- Run `npm run build` before finishing.
- Run relevant tests when available.

Recommended module layout:

- Keep existing dashboard read code in `features/admin/` unless it must be shared.
- Add CRM-specific modules under `features/admin-crm/` or clearly named submodules under `features/admin/`.
- Keep Zod schemas close to server actions, for example `features/admin-crm/customers/schema.ts`.
- Keep admin mutations in action files, for example `features/admin-crm/customers/actions.ts`.
- Keep admin read models in query files, for example `features/admin-crm/customers/queries.ts`.
- Keep reusable order write logic in `features/orders/`, not in customer or admin page components.

Suggested feature boundaries:

- `features/admin-crm/customers/`
- `features/admin-crm/products/`
- `features/admin-crm/routes/`
- `features/admin-crm/promotions/`
- `features/admin-crm/recommendations/`
- `features/admin-crm/manual-orders/`
- `features/orders/` for shared pricing, snapshot, status, and order creation utilities.

Page rules:

- Admin pages under `app/admin/**` must call `requireAdmin('/admin/...')`.
- Pages should call query functions and render feature components.
- Pages should not contain Prisma writes, business rules, pricing logic, or permission logic.
- Client components may manage form state, loading states, and optimistic local UI only.
- Server actions must perform final validation and authorization.

Shared order logic rule:

- Extract the private order write-context behavior currently inside `features/customer-portal/actions.ts` into a shared order service or utility.
- Customer order submission and admin manual order submission must use the same shared logic for:
  - Loading customer, route, price list, and active products.
  - Resolving prices.
  - Filtering inactive products.
  - Creating order snapshot lines.
  - Computing totals.
  - Choosing submitted vs special-request status.
- Do not duplicate manual order pricing or line snapshot logic in an admin-only action.

UI/UX rules:

- Preserve Hebrew RTL layout and copy direction.
- Preserve the existing admin visual direction: compact operational CRM screens, restrained colors, and scannable tables/lists.
- Use existing components where practical: `AdminShell`, `Button`, `Card`, admin status components, and current formatting helpers.
- Add loading, empty, validation, and error states for admin forms and lists.
- Do not introduce a marketing-style admin UI.

Data integrity rules:

- Use Prisma transactions for multi-model mutations such as customer plus notification preferences, customer plus linked user email, product plus price list item, and order plus order lines.
- Use soft activation toggles for Customer, Product, Route, Promotion, and Recommendation records.
- Preserve historical order line snapshots even when products, prices, or customers are edited later.
- Revalidate affected pages after successful mutations.

## Validation Rules

All admin forms and server actions must use Zod.

General action validation:

- Trim user-entered strings.
- Convert empty optional text fields to `null` where the Prisma model allows null.
- Limit text lengths explicitly.
- Validate foreign key IDs as non-empty strings, then verify referenced records exist server-side.
- Do not accept client-provided prices, route windows, deadlines, product names, totals, or status for order creation.
- Return structured `ActionResult<T>` values using `actionOk` and `actionError`.

Customer validation:

- `name`, `contact`, `phone`, `region`, `address`, `routeId`, and `priceListId` are required.
- `email` is optional but must be a valid email when present.
- `notes` and `statusLabel` should have reasonable max lengths.
- `isActive` must be boolean.
- `routeId` must refer to an existing route.
- `priceListId` must refer to an existing price list.
- Notification preference booleans must be booleans.

Product validation:

- `sku`, `name`, `category`, `unit`, and `caseSize` are required.
- `sku` must be unique and normalized consistently.
- `basePrice` must be a positive decimal with two-decimal currency precision.
- `minQty` must be an integer greater than or equal to 1.
- `imageUrl` must be optional and URL-like when present.
- `description`, `stockLabel`, and `assetImage` should have reasonable max lengths.
- `isActive` must be boolean.

Route validation:

- `name`, `region`, `deliveryWeekday`, `cutoffWeekday`, `cutoffTime`, `nextDeliveryAt`, and `nextCutoffAt` are required.
- Weekdays should use the existing JavaScript-style convention, `0` through `6`, unless the implementation documents and consistently migrates another convention.
- `cutoffTime` should match `HH:mm`.
- `nextCutoffAt` should be before or equal to the relevant `nextDeliveryAt`.
- Ops contact fields are optional and length-limited.
- `isActive` must be boolean.

Promotion validation:

- `title`, `tag`, `description`, and `productId` are required.
- `productId` must refer to an existing active product unless editing an existing inactive promotion intentionally.
- `startsAt` and `endsAt` are optional.
- If both dates are present, `startsAt` must be before `endsAt`.
- `isActive` must be boolean.

Recommendation validation:

- `customerId` and `productId` are required.
- Customer and product must exist.
- Prefer active customers and active products for new active recommendations.
- Enforce or gracefully handle the existing unique pair: `customerId + productId`.
- `reason` is optional and length-limited.
- `isActive` must be boolean.

Manual order validation:

- `customerId` is required and must refer to an active customer.
- Selected customer route must be active.
- Items array must contain at least one positive quantity item after filtering.
- Each item `productId` must be non-empty.
- Each item quantity must be an integer greater than zero and at least the product `minQty`.
- Products must be active and available in the customer's pricing context.
- Notes and internal notes must be length-limited.
- Intake channel must be one of the UI-supported values: `PHONE`, `WHATSAPP`, or `ADMIN_MANUAL`.
- Persist `Order.source = ADMIN` unless a schema migration is intentionally included.

## Authorization Rules

Page authorization:

- Every admin route must call `requireAdmin('/admin/...')`.
- Customer routes must keep existing customer scoping through `requireCustomerPage`.

Action authorization:

- Every admin mutation must call `assertAdminAction()` server-side.
- Server actions must not trust hidden form fields or client-side role checks.
- A customer session must never be able to call admin create/update/toggle/manual-order actions successfully.
- Authorization must be checked before any database mutation.
- Prefer parsing the basic input shape first, then assert admin permissions, then load and validate database state.

Data access authorization:

- Admin queries may read CRM data after page-level admin guard.
- If query functions are later exposed outside guarded pages, add explicit admin authorization there too.
- Customer-facing queries must never expose other customers' data.

## Testing Requirements

Add or update focused tests with Vitest.

Authorization tests:

- `assertAdminAction` allows admin sessions.
- `assertAdminAction` rejects customer sessions.
- `assertAdminAction` rejects anonymous sessions.
- Customer sessions cannot call admin customer/product/route/promotion/manual-order actions.

Validation tests:

- Customer create/update schemas accept valid inputs and reject invalid email, missing required fields, invalid route/price list references, and oversized notes.
- Product create/update schemas reject invalid price, duplicate/invalid SKU behavior where testable, invalid URL, and `minQty < 1`.
- Route create/update schemas reject invalid weekdays, invalid cutoff time, and cutoff after delivery.
- Promotion schemas reject invalid date ranges and missing product.
- Manual order schema rejects empty orders, invalid quantities, invalid intake channel, and oversized notes.

Order domain tests:

- Shared order creation context resolves customer price list prices consistently for customer and admin flows.
- Manual order creation snapshots product name, unit price, quantity, and line total.
- Manual order rejects inactive products.
- Manual order rejects inactive customers.
- Manual order rejects inactive routes.
- Manual order rejects products outside the customer's pricing context.
- Manual order uses `SUBMITTED` before cutoff and `SPECIAL_REQUEST` after cutoff.
- Manual order persists `source = ADMIN`.

Query/integration-style tests where practical:

- Manual orders appear in admin dashboard queries when their status is active.
- Manual orders appear in admin customer detail order history.
- Manual orders appear in admin route detail customer latest order context where applicable.
- Customer portal order history treats manual orders as real customer orders when they belong to that customer.

Existing regression tests:

- Existing customer order submission still works.
- Existing order snapshot tests still pass.
- Existing authorization tests still pass.
- Existing admin dashboard queries still build and type-check.

Testing approach:

- Prefer pure utility tests for pricing, snapshots, status, and validation.
- For server actions, mock `getServerSession` or `assertAdminAction` consistently with existing tests.
- Mock Prisma where a full test database is not already configured.
- Do not add brittle UI tests unless a testing setup already supports them.

## Commands To Run

Run these before finishing the implementation:

```bash
npx prisma validate
npm run db:generate
npm test
npm run build
```

Notes:

- `npm run build` already runs `prisma generate`, but run `npm run db:generate` explicitly when Prisma schema or generated client types change.
- Run targeted tests during development, then run the full `npm test`.
- If seed data changes, run `npm run db:seed` locally to verify the demo foundation still works.

## Suggested Implementation Sequence

1. Add or refine shared order write utilities under `features/orders/`.
2. Refactor customer order actions to use the shared order utilities without changing behavior.
3. Add tests proving the customer flow still snapshots prices and totals correctly.
4. Add admin CRM schemas and actions for customers.
5. Add customer management pages/components.
6. Add admin CRM schemas and actions for products, including price-list safety.
7. Add product management pages/components.
8. Add admin CRM schemas and actions for routes.
9. Add route management pages/components while preserving existing route detail.
10. Add promotion and recommendation schemas/actions/pages.
11. Build manual order queries, action, and UI on top of the shared order utilities.
12. Update admin dashboard/customer/route/order views only as needed to expose manual orders and source/intake context.
13. Run all required checks and fix failures.

After each major step, keep the app buildable and run the narrowest relevant tests.

## Definition Of Done

This slice is complete when:

- Admin can view, create, edit, activate, and deactivate customers.
- Admin can view, create, edit, activate, and deactivate products.
- Admin can view, create, edit, activate, and deactivate routes.
- Admin can view, create, edit, activate, and deactivate promotions.
- Admin can manage basic customer product recommendations.
- Admin can create a real manual order for a customer.
- Manual orders use the same pricing resolution and order line snapshot rules as customer-submitted orders.
- Manual orders are saved as `Order.source = ADMIN` unless a deliberate schema migration adds more source detail.
- Manual order intake channel is captured in a clear, queryable-enough way for this slice or documented as a limitation.
- Manual orders appear in relevant admin order, dashboard, route, and customer views.
- Existing customer reorder flow still works.
- Admin/customer authorization remains correct.
- All admin mutations validate with Zod.
- No hard deletes are used for CRM operational records.
- Hebrew RTL behavior and current UI direction are preserved.
- `npx prisma validate` passes.
- `npm test` passes.
- `npm run build` passes.

## Required Implementation Summary

When implementation is finished, summarize:

- What changed.
- Which files/modules were added or modified.
- How to test each new admin flow manually.
- Which automated tests were added or updated.
- Which commands were run and their results.
- Any remaining TODOs or intentional limitations, especially around login account creation, price-list management, and manual order intake channel persistence.
