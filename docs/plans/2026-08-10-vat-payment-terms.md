# VAT Disclosure and Payment Terms Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** להבהיר בכל מסלול ההזמנה שהמחירים הם לפני מע"מ, ולאפשר בסקירת ההזמנה בחירה בין שוטף 30 לבין תשלום מיידי/מזומן עם 5% הנחה שנשמרת בהזמנה ומחושבת בשרת.

**Architecture:** תנאי התשלום ימומשו כנתון ברמת `Order`, ולא כ־`Promotion` של מוצר. מנוע המבצעים הקיים ימשיך לחשב הנחות שורה; לאחריו תחושב הנחת התשלום על הסכום שלאחר מבצעי המוצר, והיא תישמר בנפרד כדי לשמור היסטוריה, להסביר את הסכום בממשקי הלקוח והניהול, ולמנוע הנחה אוטומטית ללקוחות שוטף 30.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma 6/PostgreSQL, Zod 4, Vitest, Tailwind CSS.

---

## מצב קיים שנבדק

- המחירון והמבצעים מחושבים ב־`features/pricing/engine.ts`; מבצעי מוצר נבחרים לפי עדיפות ונשמרים כ־snapshot בכל `OrderLine`.
- יצירת הזמנה אמיתית עוברת דרך `features/orders/service.ts` ו־`features/orders/write.ts`, כך שאפשר לאכוף את ההנחה בצד השרת.
- `Order` שומר כיום `subtotal`, `discountTotal` ו־`total`, אבל אינו שומר תנאי תשלום או הנחת תשלום.
- מסך הבחירה המבוקש הוא `components/customer/ReviewOrderClient.tsx`; האישור ההיסטורי מוצג ב־`components/customer/ConfirmationClient.tsx`.
- הכיתוב המשותף `PRICES_BEFORE_VAT_LABEL` כבר קיים ב־`features/owner-rules/constants.ts`, אך כרגע מופיע רק בטופס ההרשמה.
- קיים preset בשם `cash-5` בממשק המבצעים. הוא אינו תלוי בבחירת תנאי תשלום ולכן אסור להשתמש בו למימוש הדרישה החדשה.

## החלטות מוצר שעליהן התוכנית מבוססת

1. המחירים והסכומים נשארים לפני מע"מ; בשלב זה לא מחשבים שיעור מע"מ ולא מוסיפים מע"מ לסכום לתשלום.
2. ברירת המחדל בסקירת הזמנה היא `שוטף 30`, כדי לשמר את ההתנהגות הקיימת.
3. האפשרות השנייה היא תנאי תשלום אחד בשם `תשלום מיידי / מזומן`, המזכה ב־5% הנחה.
4. סדר החישוב: מחירון → מבצעי מוצר קיימים → 5% הנחת תשלום. לכן ההנחה של 5% מצטברת עם מבצעי מוצר, אך מחושבת על היתרה שלאחריהם.
5. מינימום ההזמנה המוסדית נבדק לאחר מבצעי המוצר ולפני הנחת התשלום. לקוח שהגיע למינימום לא ייפסל רק מפני שבחר תשלום מיידי.
6. כל סכום מעוגל לאגורות באמצעות כלל העיגול הקיים במערכת.
7. הזמנות ישנות והזמנות ידניות של מנהל יקבלו `שוטף 30` ו־0 הנחת תשלום. בחירת תנאי תשלום בהזמנה ידנית אינה חלק מהסבב הזה.
8. הנחת התשלום נשמרת ברמת ההזמנה ואינה מחולקת בין השורות. כך נמנעות שגיאות חלוקת אגורות, והשורות ממשיכות לתעד רק מחירון ומבצעי מוצר.

### נוסחת הסכומים

```text
subtotal                  = סכום מחירי המחירון
discountTotal             = סכום מבצעי המוצר הקיימים
amountAfterPromotions     = subtotal - discountTotal
paymentDiscountTotal      = IMMEDIATE_OR_CASH ? round(amountAfterPromotions * 0.05) : 0
total                     = amountAfterPromotions - paymentDiscountTotal
```

## חלופות שנשקלו

- **מומלץ: שדות תנאי תשלום ברמת ההזמנה.** בחירה מפורשת, snapshot היסטורי, חישוב שרת והצגה נפרדת בדוחות.
- **Promotion רגיל של 5%.** נדחה כי מנוע המבצעים פועל לפני בחירת תנאי התשלום ועלול להעניק את ההנחה גם לשוטף 30.
- **שמירה בהערות בלבד.** נדחה כי אי אפשר לאמת, לחשב או לדווח באופן אמין על מידע חופשי.

---

### Task 1: יצירת מודול דומיין לתנאי תשלום

**Files:**
- Create: `features/orders/payment-terms.ts`
- Create: `features/orders/payment-terms.test.ts`

**Step 1: Write the failing tests**

להוסיף בדיקות עבור שוטף 30, 5% על הסכום לאחר מבצעים, ועיגול לאגורות:

```ts
expect(calculatePaymentTermsSummary(900, 'NET_30')).toEqual({
  paymentDiscountPercent: 0,
  paymentDiscountTotal: 0,
  total: 900,
});

expect(calculatePaymentTermsSummary(900, 'IMMEDIATE_OR_CASH')).toEqual({
  paymentDiscountPercent: 5,
  paymentDiscountTotal: 45,
  total: 855,
});

expect(calculatePaymentTermsSummary(123.45, 'IMMEDIATE_OR_CASH')).toEqual({
  paymentDiscountPercent: 5,
  paymentDiscountTotal: 6.17,
  total: 117.28,
});
```

**Step 2: Verify the tests fail**

Run: `npx vitest run features/orders/payment-terms.test.ts`

Expected: FAIL because `payment-terms.ts` does not exist.

**Step 3: Implement the pure domain module**

```ts
export const paymentTermValues = ['NET_30', 'IMMEDIATE_OR_CASH'] as const;
export type PaymentTermValue = (typeof paymentTermValues)[number];

export const paymentTermLabels: Record<PaymentTermValue, string> = {
  NET_30: 'שוטף 30',
  IMMEDIATE_OR_CASH: 'תשלום מיידי / מזומן',
};

export const IMMEDIATE_PAYMENT_DISCOUNT_PERCENT = 5;

export function calculatePaymentTermsSummary(amountAfterPromotions: number, paymentTerm: PaymentTermValue) {
  const paymentDiscountPercent = paymentTerm === 'IMMEDIATE_OR_CASH' ? IMMEDIATE_PAYMENT_DISCOUNT_PERCENT : 0;
  const paymentDiscountTotal = roundCurrency(amountAfterPromotions * (paymentDiscountPercent / 100));

  return {
    paymentDiscountPercent,
    paymentDiscountTotal,
    total: roundCurrency(amountAfterPromotions - paymentDiscountTotal),
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```

**Step 4: Verify the tests pass**

Run: `npx vitest run features/orders/payment-terms.test.ts`

Expected: PASS, 3 tests.

**Step 5: Commit**

```bash
git add features/orders/payment-terms.ts features/orders/payment-terms.test.ts
git commit -m "feat: add order payment terms domain"
```

---

### Task 2: הוספת snapshot של תנאי התשלום למסד הנתונים

**Files:**
- Modify: `prisma/schema.prisma:22-35`
- Modify: `prisma/schema.prisma:233-259`
- Create: `prisma/migrations/20260810120000_order_payment_terms/migration.sql`

**Step 1: Add the Prisma enum and fields**

```prisma
enum PaymentTerm {
  NET_30
  IMMEDIATE_OR_CASH
}

model Order {
  // existing fields
  paymentTerm            PaymentTerm @default(NET_30)
  paymentDiscountPercent Decimal     @default(0) @db.Decimal(5, 2)
  paymentDiscountTotal   Decimal     @default(0) @db.Decimal(10, 2)
}
```

**Step 2: Add the forward-only migration**

```sql
CREATE TYPE "PaymentTerm" AS ENUM ('NET_30', 'IMMEDIATE_OR_CASH');

ALTER TABLE "Order"
  ADD COLUMN "paymentTerm" "PaymentTerm" NOT NULL DEFAULT 'NET_30',
  ADD COLUMN "paymentDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentDiscountTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
```

ה־defaults מבצעים backfill בטוח להזמנות קיימות ללא שינוי ב־`total` ההיסטורי.

**Step 3: Validate and regenerate Prisma Client**

Run: `npx prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`.

Run: `npm run db:generate`

Expected: Prisma Client generated successfully.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260810120000_order_payment_terms/migration.sql
git commit -m "feat: persist order payment terms"
```

---

### Task 3: אכיפת החישוב בצד השרת

**Files:**
- Modify: `features/orders/write.test.ts:63-214`
- Modify: `features/orders/write.ts:30-117`
- Modify: `features/orders/service.ts:97-183`
- Modify: `features/customer-portal/schema.ts:13-17`
- Modify: `features/customer-portal/actions.ts:102-119`
- Modify: `features/customer-portal/actions.test.ts:59-108`
- Modify: `features/admin-crm/actions.ts:740-755`

**Step 1: Add failing order-write tests**

להוסיף ל־`write.test.ts`:

- `NET_30` משאיר את הסכום ללא הנחת תשלום.
- `IMMEDIATE_OR_CASH` על הזמנה עם `subtotal=48` והנחת מוצר `12` מחשב 5% מתוך `36`: הנחת תשלום `1.80`, סה"כ `34.20`.
- הזמנה שבה הסכום לאחר מבצעי מוצר עומד במינימום נשארת תקינה גם אם הנחת התשלום מורידה את `total` מתחת למינימום.
- ערך תנאי התשלום נשמר ב־payload.

Run: `npx vitest run features/orders/write.test.ts`

Expected: FAIL because `buildSubmittedOrderPayload` does not accept or persist `paymentTerm`.

**Step 2: Extend the submitted-order payload**

ב־`buildSubmittedOrderPayload` לקבל `paymentTerm: PaymentTermValue`, לחשב:

```ts
const merchandiseTotal = pricing.total;
const payment = calculatePaymentTermsSummary(merchandiseTotal, paymentTerm);

validateInstitutionalOrderRules({
  source,
  total: merchandiseTotal,
  items: pricing.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
  products: context.products,
});
```

ולשמור ב־`order`:

```ts
paymentTerm,
paymentDiscountPercent: payment.paymentDiscountPercent,
paymentDiscountTotal: payment.paymentDiscountTotal,
total: payment.total,
```

`discountTotal` נשאר סכום מבצעי המוצר בלבד.

**Step 3: Persist the fields on both create and draft replacement**

ב־`createSubmittedOrder` להוסיף `paymentTerm` לקלט ולהעביר אותו ל־`buildSubmittedOrderPayload`. להוסיף את שלושת השדות החדשים גם ל־`create` וגם ל־`update` של `prisma.order.upsert`.

ב־`saveDraftOrderAction` להשאיר draft כ־`NET_30`, `paymentDiscountPercent: 0`, `paymentDiscountTotal: 0`; הבחירה נעשית רק במסך הסקירה ונדרסת בעת השליחה.

**Step 4: Validate the customer action input with Zod**

```ts
export const submitCustomerOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(orderItemInputSchema).min(1),
  notes: z.string().max(1000).optional(),
  paymentTerm: z.enum(paymentTermValues),
});
```

להעביר `parsed.paymentTerm` ל־`createSubmittedOrder`. הדבר מונע מהלקוח לשלוח אחוז הנחה שרירותי; השרת מקבל רק את סוג התנאי ומחשב בעצמו את 5%.

**Step 5: Preserve manual-order behavior explicitly**

ב־`createManualOrderAction` להעביר `paymentTerm: 'NET_30'`. אין להוסיף בחירה חדשה למסך ההזמנה הידנית בסבב הזה.

**Step 6: Add action assertions**

ב־`actions.test.ts` לשלוח `paymentTerm: 'IMMEDIATE_OR_CASH'` ולוודא:

```ts
expect(mockedCreateSubmittedOrder).toHaveBeenCalledWith(
  expect.objectContaining({ paymentTerm: 'IMMEDIATE_OR_CASH' }),
);
```

להוסיף בדיקה ש־`INVALID` מוחזר כשגיאת Zod ואינו מגיע ל־`createSubmittedOrder`.

**Step 7: Run focused tests**

Run: `npx vitest run features/orders/write.test.ts features/customer-portal/actions.test.ts`

Expected: PASS.

**Step 8: Commit**

```bash
git add features/orders/write.ts features/orders/write.test.ts features/orders/service.ts features/customer-portal/schema.ts features/customer-portal/actions.ts features/customer-portal/actions.test.ts features/admin-crm/actions.ts
git commit -m "feat: apply immediate payment discount server side"
```

---

### Task 4: העברת תנאי התשלום וההנחה דרך מודלי התצוגה

**Files:**
- Modify: `features/customer-portal/types.ts:51-70`
- Modify: `features/customer-portal/order-mapping.ts:17-64`
- Modify: `features/customer-portal/order-mapping.test.ts:4-59`
- Modify: `features/admin/types.ts:26-50`
- Modify: `features/admin/queries.ts:189-340`
- Modify: `features/admin/queries.test.ts:34-124`

**Step 1: Add failing mapping tests**

לעדכן fixtures כך שיכללו:

```ts
paymentTerm: 'IMMEDIATE_OR_CASH',
paymentDiscountPercent: 5,
paymentDiscountTotal: 4.2,
```

ולוודא שהערכים נשמרים ב־`PortalOrder` וב־`AdminOrderSummary` בלי חישוב מחדש ממחירי הקטלוג.

**Step 2: Extend portal types and mapping**

להוסיף ל־`PortalOrder`:

```ts
paymentTerm: PaymentTermValue;
paymentDiscountPercent: number;
paymentDiscountTotal: number;
```

ב־`mapPortalOrder` למפות את שדות ה־snapshot. עבור `empty` להשתמש ב־`NET_30`, `0`, `0`.

**Step 3: Extend admin types and queries**

להוסיף את אותם שדות ל־`AdminOrderSummary`, ולהמיר `Decimal` ל־`number` ב־`mapOrderSummary`. לעדכן את טיפוס קלט המיפוי כדי שה־TypeScript יבטיח שהשדות נטענים מכל שאילתת הזמנה.

**Step 4: Run focused tests**

Run: `npx vitest run features/customer-portal/order-mapping.test.ts features/admin/queries.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add features/customer-portal/types.ts features/customer-portal/order-mapping.ts features/customer-portal/order-mapping.test.ts features/admin/types.ts features/admin/queries.ts features/admin/queries.test.ts
git commit -m "feat: expose payment terms in order views"
```

---

### Task 5: הוספת הבחירה והבהרת המע"מ במסכי הלקוח

**Files:**
- Modify: `components/customer/CustomerCatalogApp.tsx:96-175`
- Modify: `components/customer/ReviewOrderClient.tsx:22-205`
- Modify: `components/customer/ConfirmationClient.tsx:14-108`
- Reuse: `features/owner-rules/constants.ts:3`

**Step 1: Add a clear VAT disclosure to the catalog**

לייבא `PRICES_BEFORE_VAT_LABEL` ולהציג אותו:

- באזור העליון של הקטלוג, בסמוך לפרטי החלוקה.
- בסרגל הסל התחתון ליד הסכום.

אין צורך להוסיף את הטקסט לכל כרטיס מוצר; הודעה גלובלית קבועה וסימון ליד סיכום הסל ברורים יותר ופחות עמוסים.

**Step 2: Add controlled payment-term selection to review**

ב־`ReviewOrderClient`:

```ts
const [paymentTerm, setPaymentTerm] = useState<PaymentTermValue>('NET_30');
const paymentSummary = useMemo(
  () => calculatePaymentTermsSummary(cartPricing.total, paymentTerm),
  [cartPricing.total, paymentTerm],
);
```

להציג שתי אפשרויות radio נגישות לפני שדה ההערות:

- `שוטף 30` — `ללא הנחת תשלום`.
- `תשלום מיידי / מזומן` — badge של `5% הנחה` והסבר שההנחה מחושבת לאחר מבצעי המוצר.

להעביר `paymentTerm` ל־`submitCustomerOrderAction`.

**Step 3: Make the review breakdown explicit**

סדר השורות בסיכום:

1. `סכום ביניים` — `cartPricing.subtotal`.
2. `מבצעים והנחות מוצר` — `cartPricing.discountTotal`, אם גדול מ־0.
3. `הנחת תשלום מיידי (5%)` — `paymentSummary.paymentDiscountTotal`, רק בבחירה המתאימה.
4. `סה"כ לפני מע"מ` — `paymentSummary.total`.

הכפתור ימשיך להיות חסום בסל ריק ובזמן שליחה. אם השרת מחזיר שגיאה, הבחירה והסכומים יישארו מוצגים לתיקון ושליחה חוזרת.

**Step 4: Render the persisted snapshot on confirmation**

ב־`ConfirmationClient` אין לחשב את ההנחה מחדש. להציג:

- תנאי תשלום לפי `lastOrder.paymentTerm`.
- מבצעי מוצר מתוך `lastOrder.discountTotal`.
- הנחת תשלום מתוך `lastOrder.paymentDiscountTotal`.
- `סה"כ לפני מע"מ` מתוך `lastOrder.total`.

ה־fallback להזמנה ריקה ישתמש ב־`NET_30` וללא הנחת תשלום בלבד.

**Step 5: Run type/build verification for the client flow**

Run: `npm run build`

Expected: successful Prisma generation and Next.js production build.

**Step 6: Commit**

```bash
git add components/customer/CustomerCatalogApp.tsx components/customer/ReviewOrderClient.tsx components/customer/ConfirmationClient.tsx
git commit -m "feat: add payment choice to customer order review"
```

---

### Task 6: הצגת תנאי התשלום בממשק הניהול

**Files:**
- Modify: `features/admin/components/AdminOrderDetail.tsx:42-78`
- Modify: `features/admin/components/AdminDashboard.tsx:230-283`

**Step 1: Show the payment term in order context**

להציג `תנאי תשלום: שוטף 30` או `תנאי תשלום: תשלום מיידי / מזומן` בעמוד ההזמנה ובחלונית סקירת ההזמנה בדשבורד.

**Step 2: Separate the discount rows**

להציג:

- `מבצעים והנחות מוצר` מתוך `discountTotal`.
- `הנחת תשלום מיידי (5%)` מתוך `paymentDiscountTotal`.
- `סה"כ לפני מע"מ` מתוך `total`.

כך צוות התפעול לא יצטרך לנחש מדוע סכום השורות גבוה מהסכום הסופי.

**Step 3: Verify the admin routes**

Run: `npm run build`

Expected: `/admin` and `/admin/orders/[orderId]` compile successfully.

**Step 4: Commit**

```bash
git add features/admin/components/AdminOrderDetail.tsx features/admin/components/AdminDashboard.tsx
git commit -m "feat: show payment discounts to admins"
```

---

### Task 7: מניעת כפל הנחה דרך preset המבצעים הישן

**Files:**
- Modify: `features/owner-rules/constants.ts:66-84`
- Modify: `features/admin-crm/components/AdminCrmManagers.tsx:1332-1347`

**Step 1: Remove the `cash-5` promotion preset**

להסיר את preset `cash-5` מ־`promotionPresets`. הנחת תשלום אינה עוד מבצע מוצר שנוצר ידנית.

**Step 2: Remove preset-specific UI logic**

להחליף את:

```ts
setNamedFormValue(form, 'priority', preset.id === 'cash-5' ? '30' : '20');
```

ב־priority אחיד של preset המבצע שנותר.

**Step 3: Audit production data before deployment**

להריץ מול בסיס הנתונים המיועד לפריסה חיפוש read-only אחר Promotions קיימים ששמם או תיאורם מציינים מזומן/תשלום מיידי. אם נמצא מבצע כזה, להשבית אותו רק לאחר זיהוי ואישור שהוא מייצג את אותה הנחת 5%; אחרת תיתכן הנחה כפולה.

אין למחוק Promotions אוטומטית במיגרציה לפי טקסט חופשי.

**Step 4: Verify no stale preset remains**

Run: `rg -n "cash-5|הנחת מזומן|5% מזומן" features data prisma/seed.ts`

Expected: no payment-discount preset remains. תוצאות אחרות מחייבות בדיקה ידנית לפני פריסה.

**Step 5: Commit**

```bash
git add features/owner-rules/constants.ts features/admin-crm/components/AdminCrmManagers.tsx
git commit -m "fix: retire unconditional cash promotion preset"
```

---

### Task 8: אימות מלא ותרחישי קבלה

**Files:**
- Test: `features/orders/payment-terms.test.ts`
- Test: `features/orders/write.test.ts`
- Test: `features/customer-portal/actions.test.ts`
- Test: `features/customer-portal/order-mapping.test.ts`
- Test: `features/admin/queries.test.ts`

**Step 1: Run the focused regression suite**

Run:

```bash
npx vitest run features/orders/payment-terms.test.ts features/orders/write.test.ts features/customer-portal/actions.test.ts features/customer-portal/order-mapping.test.ts features/admin/queries.test.ts
```

Expected: all focused tests PASS.

**Step 2: Run all tests**

Run: `npm test`

Expected: all test files PASS with zero failures.

**Step 3: Run the required production build**

Run: `npm run build`

Expected: Prisma Client generated and Next.js build completes successfully.

**Step 4: Apply the migration in the target environment**

Run: `npx prisma migrate deploy`

Expected: `20260810120000_order_payment_terms` is applied successfully.

**Step 5: Perform manual acceptance checks**

1. בקטלוג רואים בבירור שהמחירים לפני מע"מ.
2. סקירת הזמנה נפתחת כברירת מחדל על שוטף 30 והסכום אינו משתנה.
3. מעבר לתשלום מיידי/מזומן מוסיף שורת 5% ומעדכן מיד את הסכום.
4. חזרה לשוטף 30 מסירה את הנחת התשלום.
5. בהזמנה עם מבצע מוצר רואים שתי שורות הנחה נפרדות; 5% מחושב לאחר מבצע המוצר.
6. הזמנה שהגיעה למינימום לפני הנחת התשלום מתקבלת גם אם הסכום הסופי נמוך ממנו.
7. רענון עמוד האישור מציג את תנאי התשלום והסכומים השמורים, גם אם מחירון או אחוז עתידי ישתנו.
8. עמוד ההזמנה ודשבורד המנהל מציגים את תנאי התשלום ושתי ההנחות בנפרד.
9. שליחת `paymentTerm` לא חוקי נכשלת בשרת ואינה יוצרת הזמנה.
10. הזמנה ישנה והזמנה ידנית מוצגות כשוטף 30 ללא שינוי בסכום ההיסטורי.

**Step 6: Confirm the final worktree state**

Run: `git status --short --branch`

Expected: only intentional feature changes are present; pre-existing unrelated user changes remain untouched.

---

## מחוץ להיקף

- חישוב סכום מע"מ, שיעור מע"מ משתנה או סכום כולל מע"מ.
- סליקה, רישום קבלת מזומן, התאמת חשבוניות או אינטגרציה למערכת הנהלת חשבונות.
- בחירת תנאי תשלום בהזמנה ידנית של מנהל.
- הרשאות שונות לתנאי תשלום לפי לקוח.
- שינוי חוקי מבצעי המוצר הקיימים מעבר לסדר החישוב המוגדר כאן.

## קריטריוני סיום

- תנאי התשלום נבחרים בסקירת ההזמנה ונאכפים ב־Zod ובשרת.
- 5% מחושבים על הסכום לאחר מבצעי מוצר, מעוגלים לאגורות ונשמרים כ־snapshot.
- מינימום ההזמנה נבדק לפני הנחת התשלום.
- כל מסכי הלקוח הרלוונטיים מציינים שהמחירים לפני מע"מ.
- אישור ההזמנה וממשק הניהול מציגים תנאי תשלום והנחת תשלום מתוך הנתונים השמורים.
- אין preset פעיל בממשק שמעניק 5% מזומן ללא תלות בבחירה.
- `npm test` ו־`npm run build` עוברים בהצלחה.
