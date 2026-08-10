# Sequential Order Numbers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a globally increasing human order number beginning at `#1001` and use it instead of internal order IDs in customer, admin, and WhatsApp presentation.

**Architecture:** PostgreSQL owns number allocation through a sequence-backed unique integer column while the existing CUID remains the internal primary key. Feature-level mapping passes the number to UI types, and a single formatting helper produces the `#1001` label. Routes, mutations, authorization, relations, and notification deduplication continue to use the internal ID.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma 6, PostgreSQL/Neon, Vitest.

---

### Task 1: Add the order-number display contract

**Files:**
- Create: `features/orders/order-number.test.ts`
- Create: `features/orders/order-number.ts`

**Step 1: Write the failing test**

Test that `formatOrderNumber(1001)` returns `#1001` and that a later number remains unpadded.

**Step 2: Run test to verify it fails**

Run: `npm test -- features/orders/order-number.test.ts`

Expected: FAIL because `features/orders/order-number.ts` does not exist.

**Step 3: Write minimal implementation**

Export `formatOrderNumber(orderNumber: number): string` and return `#${orderNumber}`.

**Step 4: Run test to verify it passes**

Run: `npm test -- features/orders/order-number.test.ts`

Expected: PASS.

**Step 5: Commit**

```powershell
git add features/orders/order-number.ts features/orders/order-number.test.ts
git commit -m "feat: add human order number formatter"
```

### Task 2: Add the database-owned sequence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260810190000_sequential_order_numbers/migration.sql`

**Step 1: Add the Prisma field contract**

Add `orderNumber Int @unique @default(autoincrement())` to `Order`.

**Step 2: Write the forward migration**

Create `Order_orderNumber_seq`, add the nullable column, backfill with `ROW_NUMBER() OVER (ORDER BY "createdAt", "id") + 1000`, advance the sequence to the maximum, set the default, enforce `NOT NULL`, assign sequence ownership, and create a unique index.

**Step 3: Regenerate Prisma Client**

Run: `npm run db:generate`

Expected: Prisma Client generates successfully and exposes `orderNumber`.

**Step 4: Validate the migration against a populated local database**

Run the migration through `prisma migrate deploy` against a disposable PostgreSQL database containing at least two existing orders.

Expected: existing orders receive `1001` and `1002`; a newly inserted order receives `1003`; the column is required and unique.

**Step 5: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations/20260810190000_sequential_order_numbers/migration.sql
git commit -m "feat: persist sequential order numbers"
```

### Task 3: Carry the number through customer mapping

**Files:**
- Modify: `features/customer-portal/order-mapping.test.ts`
- Modify: `features/customer-portal/order-mapping.ts`
- Modify: `features/customer-portal/types.ts`
- Modify: `components/customer/ConfirmationClient.tsx`

**Step 1: Write the failing mapping test**

Add `orderNumber: 1001` to the Prisma-shaped fixture and assert the mapped portal order exposes `orderNumber: 1001`.

**Step 2: Run test to verify it fails**

Run: `npm test -- features/customer-portal/order-mapping.test.ts`

Expected: FAIL because `PortalOrder` does not expose `orderNumber`.

**Step 3: Implement the mapped field**

Add `orderNumber: number | null` to `PortalOrder`, accept it in `PortalOrderSnapshot`, return `null` for the empty draft, and return the persisted number for real orders.

**Step 4: Render the customer label**

Use `formatOrderNumber` in the confirmation header and display `הזמנה #1001` only for a persisted order.

**Step 5: Run focused tests**

Run: `npm test -- features/customer-portal/order-mapping.test.ts features/orders/order-number.test.ts`

Expected: PASS.

**Step 6: Commit**

```powershell
git add features/customer-portal components/customer/ConfirmationClient.tsx
git commit -m "feat: show order numbers to customers"
```

### Task 4: Replace admin-facing raw order IDs

**Files:**
- Modify: `features/admin/queries.test.ts`
- Modify: `features/admin/queries.ts`
- Modify: `features/admin/types.ts`
- Modify: `features/admin/components/AdminDashboard.tsx`
- Modify: `features/admin/components/AdminOrderDetail.tsx`
- Modify: `features/admin/components/AdminCustomerDetail.tsx`
- Modify: `app/admin/orders/[orderId]/page.tsx`

**Step 1: Write the failing admin mapping test**

Add `orderNumber: 1001` to mocked Prisma orders and assert dashboard/detail mappings return it.

**Step 2: Run test to verify it fails**

Run: `npm test -- features/admin/queries.test.ts`

Expected: FAIL because admin summary types and mappings omit `orderNumber`.

**Step 3: Implement the mapped field**

Add `orderNumber` to `AdminOrderSummary` and to both Prisma-shaped mapping inputs and outputs.

**Step 4: Replace visible IDs**

Use `formatOrderNumber` in dashboard labels, selected-order details, customer order history, the full order page title, and its summary card. Keep `order.id` in `key`, `href`, selection state, mutations, and notification search parameters.

**Step 5: Run focused tests**

Run: `npm test -- features/admin/queries.test.ts features/orders/order-number.test.ts`

Expected: PASS.

**Step 6: Commit**

```powershell
git add app/admin/orders features/admin
git commit -m "feat: show human order numbers to admins"
```

### Task 5: Use the order number in WhatsApp and notification presentation

**Files:**
- Modify: `features/notifications/templates.test.ts`
- Modify: `features/notifications/templates.ts`
- Modify: `features/notifications/jobs.test.ts`
- Modify: `features/notifications/jobs.ts`
- Modify: `features/notifications/queries.test.ts`
- Modify: `features/notifications/queries.ts`
- Modify: `features/notifications/ui-utils.ts`
- Modify: `features/notifications/components/AdminNotificationsClient.tsx`

**Step 1: Write the failing template test**

Provide `id: 'internal-cuid'` and `orderNumber: 1001`; assert the WhatsApp `order_id` parameter and preview message contain `#1001` and not the CUID.

**Step 2: Run test to verify it fails**

Run: `npm test -- features/notifications/templates.test.ts`

Expected: FAIL because templates still use `order.id`.

**Step 3: Implement customer message formatting**

Require `orderNumber` in the template context and format it through `formatOrderNumber`. Pass `order.orderNumber` from notification jobs while retaining `order.id` for relations and deduplication.

**Step 4: Add the number to admin notification queries**

Select the related order number, expose it as nullable notification UI data, and show `#1001` in the ordinary order cell. Keep provider IDs and template keys inside admin-only diagnostic sections.

**Step 5: Run focused notification tests**

Run: `npm test -- features/notifications/templates.test.ts features/notifications/jobs.test.ts features/notifications/queries.test.ts features/notifications/ui-utils.test.ts`

Expected: PASS.

**Step 6: Commit**

```powershell
git add features/notifications
git commit -m "feat: use order numbers in customer notifications"
```

### Task 6: Verify locally and in Preview

**Files:**
- Modify only if verification exposes a tested defect.

**Step 1: Run all automated tests**

Run: `npm test`

Expected: all tests pass.

**Step 2: Run production build**

Run: `npm run build`

Expected: build, lint, and type checking pass.

**Step 3: Check repository hygiene**

Run: `git diff --check` and `git status --short --branch`.

Expected: no whitespace errors and no uncommitted changes.

**Step 4: Push and wait for Vercel**

Push `codex/vat-payment-terms`, confirm PR #8 checks pass, and wait for the updated Preview deployment to reach Ready.

**Step 5: Apply the new migration to Neon Preview**

Run `prisma migrate deploy` against the existing Neon `preview` branch using the direct connection and verify `prisma migrate status` reports the database is current.

**Step 6: Browser acceptance test**

Create isolated temporary Preview fixtures, submit two orders, and verify:

- confirmation shows consecutive numbers beginning at `#1001` or the next existing value;
- WhatsApp preview payload uses the human number;
- admin dashboard and order detail use the same number;
- raw CUID is not rendered as an order label;
- browser console has no warnings or errors.

Delete only the isolated fixtures and verify all fixture counts return to zero.

**Step 7: Final commit if verification required changes**

```powershell
git add <verified-files>
git commit -m "fix: complete order number preview verification"
```
