# VAT-Inclusive B2B Order UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display and persist the VAT-inclusive order total, improve price precision, and record a customer B2B declaration without changing products or price lists.

**Architecture:** A pure order-tax module calculates VAT from the net total after product and payment discounts. Submitted orders persist a tax and declaration snapshot; customer and admin read models expose that snapshot, while draft/catalog values use the current rate only as a preview. Zod and the shared order-write service enforce customer acceptance server-side.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6/PostgreSQL, Zod 4, Vitest, Tailwind CSS.

---

### Task 1: Tax and currency domain behavior

**Files:**
- Create: `features/orders/vat.ts`
- Create: `features/orders/vat.test.ts`
- Modify: `lib/format.ts`
- Create: `lib/format.test.ts`

**Steps:**

1. Write failing tests for 18% VAT, agorot rounding, zero values, and `money(16.9) === "16.90 ₪"` (allowing the locale's non-breaking-space form).
2. Run `npx vitest run features/orders/vat.test.ts lib/format.test.ts` and confirm the expected failures.
3. Implement `calculateVatSummary(netTotal, ratePercent = 18)` and a two-decimal ILS formatter.
4. Re-run the focused tests and confirm they pass.

### Task 2: Persist tax and B2B declaration snapshots

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260810220000_order_vat_snapshot/migration.sql`
- Modify: `features/orders/write.ts`
- Modify: `features/orders/write.test.ts`
- Modify: `features/orders/service.ts`
- Modify: `features/customer-portal/schema.ts`
- Modify: `features/customer-portal/actions.ts`
- Modify: `features/customer-portal/actions.test.ts`
- Modify: `features/customer-portal/actions.ts`
- Modify: `prisma/seed.ts`

**Steps:**

1. Write failing order-write tests proving VAT is calculated after payment discount, customer orders require acceptance, and admin orders retain null declaration fields.
2. Write a failing Zod/action test proving `commercialTermsAccepted: false` cannot create an order.
3. Add the five snapshot fields to `Order` and a forward-only migration that backfills net totals at 18% without touching catalog tables.
4. Add `commercialTermsAccepted` to the submission schema and pass it through the shared service.
5. Calculate and persist tax values in both create and update paths. Save declaration version/time only for accepted customer orders.
6. Update draft and seed writes with deterministic VAT snapshots.
7. Generate Prisma Client and run focused tests.

### Task 3: Expose snapshots through read models

**Files:**
- Modify: `features/customer-portal/types.ts`
- Modify: `features/customer-portal/order-mapping.ts`
- Modify: `features/customer-portal/order-mapping.test.ts`
- Modify: `features/admin/types.ts`
- Modify: `features/admin/queries.ts`
- Modify: `features/admin/queries.test.ts`
- Modify: `features/notifications/queries.ts`
- Modify: `features/notifications/templates.ts`
- Modify: `features/notifications/templates.test.ts`

**Steps:**

1. Add failing mapping tests for VAT and declaration snapshot fields.
2. Extend portal/admin types and mappings without recalculating persisted orders.
3. Use the gross order total in customer-facing WhatsApp total parameters and label Preview text clearly.
4. Run all mapping and notification tests.

### Task 4: Upgrade customer UX and commercial disclosure

**Files:**
- Modify: `features/owner-rules/constants.ts`
- Create: `components/customer/OrderFinancialSummary.tsx`
- Modify: `components/customer/CustomerCatalogApp.tsx`
- Modify: `components/customer/ReviewOrderClient.tsx`
- Modify: `components/customer/ConfirmationClient.tsx`
- Modify: `features/registration/components/CompanyRegistrationForm.tsx`

**Steps:**

1. Add shared B2B disclosure copy and a versioned declaration constant.
2. Build a reusable financial summary that distinguishes net, VAT, and gross, with gross visually dominant.
3. Add a gross estimate to the catalog cart bar and clearer institutional-price disclosure.
4. Add the required declaration checkbox and approval/availability/invoice notice to review.
5. Render stored VAT and declaration evidence on confirmation.
6. Strengthen registration copy so the intended institutional audience is explicit.

### Task 5: Upgrade admin visibility

**Files:**
- Modify: `features/admin/components/AdminOrderDetail.tsx`
- Modify: `features/admin/components/AdminDashboard.tsx`

**Steps:**

1. Show net, VAT, and gross totals in dashboard and order detail.
2. Show whether and when the customer accepted the current declaration; label manual orders as staff-entered.
3. Verify desktop and mobile layouts do not overflow and the gross amount remains scannable.

### Task 6: Migration and data-safety gate

**Steps:**

1. Capture Production counts and stable hashes for `Product`, `PriceList`, and `PriceListItem`.
2. Verify the migration on an isolated populated database and confirm existing order net totals are unchanged.
3. Apply the forward-only migration to Preview, then Production only after the test/build gate passes and a fresh backup exists.
4. Re-run the product/price hashes and require exact equality.

### Task 7: Full verification and Preview QA

**Steps:**

1. Run focused tests and `npm test`.
2. Run `npm run build`, `npm audit --omit=dev`, `npm run deploy:check`, and `git diff --check`.
3. Push the branch and wait for Vercel checks.
4. In Preview, verify institutional labeling, exact currency, both payment terms, VAT arithmetic, required declaration, confirmation snapshot, admin order view, and desktop/mobile rendering.
5. Confirm the PR is `CLEAN` and `MERGEABLE`; do not merge.

