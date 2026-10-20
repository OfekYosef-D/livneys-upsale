# Livney's B2B ordering

Weekly re-ordering platform for Livney's business customers (delis, cafés, caterers, wineries), with a small CRM for the team. Hebrew, right-to-left, mobile-first.

**Customers** log in, find last week's order already in the cart, adjust quantities and send it before the route's cut-off. They see promotions and products recommended for them, can request additions until the order is packed, and get email updates.
**The team** approves and packs orders, sees who has not ordered yet for each route (and can nudge them with one click), enters phone orders, and manages customers, products, price lists, promotions, routes, reminders and collections.

Stack: Next.js 15 (App Router, server actions) · React 19 · Prisma 6 / PostgreSQL · NextAuth v4 (credentials) · Zod 4 · Tailwind 3 · Vitest. Email: Resend. WhatsApp: Meta Cloud API (optional).

## Getting started

```bash
npm install
cp .env.example .env.local        # fill DATABASE_URL / DIRECT_URL at minimum
npm run db:migrate:dev
npm run db:seed:demo              # local demo data – refuses production databases
npm run dev
```

Demo logins (local seed only): `admin@example.com` / `livneys-admin`, `south@example.com` / `livneys-demo`.

| Command | |
| --- | --- |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Prisma generate + production build (type check + lint) |
| `npm run deploy:check` | Validates production environment variables |
| `npm run db:bootstrap-admin` | Creates the first real administrator |
| `npm run db:audit:critical` | Read-only data integrity report |

Production setup, first-run checklist and WhatsApp activation: [docs/deployment.md](docs/deployment.md).

## Architecture

```
app/                 Routes only: authorize → load data → render. No business logic.
components/ui/       Design system (Button, Field, Dialog, Notice, Badge, DataTable, QuantityStepper…)
components/hooks/    useServerAction – pending/feedback state for every mutation
lib/                 Cross-cutting infrastructure
  server-action.ts     adminAction / customerAction / publicAction (authorize → Zod → run → refresh → safe errors)
  errors.ts            AppError hierarchy: the only errors whose (Hebrew) message reaches users
  transactions.ts      runSerializable – serializable transactions with conflict retry
  validation.ts        Zod with Hebrew messages + shared field schemas
  datetime.ts          Israel-time conversion/formatting (DST-safe)
  money.ts, paths.ts, ids.ts, authorization.ts, db.ts …
features/<domain>/   Business modules
  orders/              quantity rules, totals (payment terms + VAT), status machine, snapshot builder, persistence, service
  pricing/             pure pricing engine (shared by server and browser cart) + promotion loading
  catalog/             a customer's priced catalog
  cart/                browser cart (same engine → no client/server price drift)
  routes/              weekly delivery schedule (rolls forward automatically)
  customer-portal/     catalog → review → order pages
  order-additions/     add-to-order requests and their approval
  notifications/       outbox jobs, channel strategies (email / WhatsApp), templates, reminders
  admin, admin-crm/    dashboard and CRUD screens; actions split per entity
  auth, registration, payments, legal, audit, customers, deployment, product-images
```

### Conventions

- **Every mutation** is a server action created with `adminAction` / `customerAction` / `publicAction` and a Zod schema. Authorization is always server-side.
- **Throw `AppError`s** (or subclasses) for expected failures with a Hebrew message; anything else is logged and shown as a generic error with a request id.
- **Money** is always rounded with `roundCurrency`; orders store immutable price snapshots (catalog changes never alter saved orders).
- **Dates** shown to users or entered in forms go through `lib/datetime.ts` (Asia/Jerusalem).
- **Audit**: admin writes call `ctx.audit(tx, …)` inside the same transaction.
- **Concurrency**: order and addition writes use optimistic `revision` checks inside `runSerializable`; submits are idempotent per client-generated key.
- **Notifications** are queued as jobs (outbox) and delivered right after the response; failures are retried by the daily cron and visible in the admin.

### Business rules (agreed with the owner)

Defined in `features/owner-rules/constants.ts` and `features/orders/totals.ts`:
minimum customer order 700 ₪ before VAT (phone orders exempt) · 5% discount for immediate/cash payment (after promotions, before VAT) · one order per customer per weekly delivery; orders after the cut-off become *special requests* · additions allowed until the order is packed and require approval.
