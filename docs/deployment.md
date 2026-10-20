# Production runbook (pilot)

Target: Vercel (Frankfurt, `fra1`) + Neon PostgreSQL (Frankfurt), email via Resend, WhatsApp off until the business number is connected.

> **Plan note.** Vercel Hobby is for personal, non-commercial use. Running real customer orders is commercial use, so the pilot should run on **Vercel Pro**. Neon Free is fine for the pilot volume; enable a paid plan (or point-in-time restore) before rolling out to all customers.

## 1. Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon **pooled** connection string |
| `DIRECT_URL` | yes | Neon **direct** connection string (migrations) |
| `NEXTAUTH_URL` | yes | Public URL, e.g. `https://orders.livneys.co.il`. Used in every email link |
| `NEXTAUTH_SECRET` | yes | ≥ 48 random bytes |
| `CRON_SECRET` | yes | ≥ 32 random bytes; Vercel cron sends it as a bearer token |
| `MFA_ENCRYPTION_KEY` | yes | exactly 32 random bytes, base64 (`openssl rand -base64 32`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | yes | Sender domain must be verified in Resend (SPF/DKIM DNS records) |
| `EMAIL_REPLY_TO` | no | Where customer replies go (e.g. the owner's inbox) |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | yes | Bot protection on the public sign-up form |
| `LEGAL_DOCUMENTS_APPROVED_VERSION` | yes in production | Must equal `LEGAL_DOCUMENT_SET_VERSION` in `features/legal/documents.ts`. Customer orders are refused until a lawyer approves that exact wording |
| `WHATSAPP_SEND_ENABLED` | no | `false` until Meta is connected (see §6) |
| `CLOUDINARY_*` | no | Enables product photo upload; otherwise paste image URLs |

`npm run deploy:check` validates the environment and prints exactly which variables are missing.

## 2. Database

```bash
npm run db:migrate:deploy      # apply migrations (never `prisma db push` in production)
npx prisma migrate status
```

The VAT rate (18%) is created by a migration. A future VAT change is a new `TaxRate` row with an `effectiveFrom` date — no code change.

Never run `npm run db:seed:demo` against production: it deletes all data (it refuses Neon/production URLs).

## 3. First administrator

```bash
BOOTSTRAP_ADMIN_EMAIL=owner@example.com BOOTSTRAP_ADMIN_NAME="שם" BOOTSTRAP_ADMIN_PASSWORD='long passphrase 2026' npm run db:bootstrap-admin
```

Sign in at `/login` and (recommended) enable two-factor authentication under **אבטחת החשבון**.

## 4. First-run setup in the admin (order matters)

1. **מחירונים** – create one price list and mark it *ברירת מחדל*.
2. **מוצרים** – add products (price before VAT, minimum, case multiple, photo).
3. **קווי חלוקה** – one route per delivery day: delivery weekday, order cut-off weekday + time. The weekly schedule then rolls forward automatically.
4. **הודעות ותזכורות** – create the weekly reminder (e.g. email, all routes, 48 hours before delivery).
5. **לקוחות** – create each pilot customer (with email) → open the customer → **הוספת משתמש**. The customer receives a password-setup email.
   Alternatively share the registration link from **בקשות הצטרפות** and convert requests into customers.

## 5. Smoke test before inviting customers

1. `GET /api/health` → `200 {"ok":true}`.
2. Log in as a test customer: catalog shows prices, the minimum-order bar, and the delivery date; submit an order ≥ 700 ₪.
3. The customer receives the "order received" email; the order appears on the admin dashboard.
4. Approve → pack → deliver; the customer gets an email at each step.
5. **הודעות ותזכורות** shows no failed messages.
6. `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/notifications` → `200` with route/reminder/delivery counts (wrong token → `401`).

## 6. Turning on WhatsApp later

1. Connect a number to the WhatsApp Business Platform (Meta Cloud API). The number must receive one SMS or voice call for verification — a landline or virtual number works — and must not be active in the regular WhatsApp app.
2. Create and get approval for message templates (one per message type listed on the notifications screen).
3. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_TEMPLATE_<KEY>` for each template, then `WHATSAPP_SEND_ENABLED=true`.
4. Point the Meta webhook to `https://<host>/api/webhooks/whatsapp`.
5. Tick *עדכונים בוואטסאפ* on customers who agreed to receive WhatsApp messages.

No code change is required — WhatsApp is a second delivery channel next to email.

## 7. Operations

- **Cron:** `vercel.json` runs `/api/cron/notifications` daily at 05:00 UTC (07:00–08:00 Israel). It rolls route schedules, queues due reminders and retries failed deliveries. Order confirmations/status emails are sent immediately, not by the cron.
- **Rollback code:** `npx vercel@latest rollback <deployment-url>`.
- **Database:** no automatic down migrations. Take a Neon branch/backup before every schema change.
- **Audit trail:** every admin change is recorded in **יומן פעולות** (append-only at the database level).
