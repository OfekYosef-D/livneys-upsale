# Free Vercel + Neon evaluation deployment

This runbook deploys a production-like evaluation at no cost. It is not a commercial go-live: Vercel Hobby is limited to personal, non-commercial use, and its cron timing is daily and imprecise.

## Deployment contract

- Vercel plan: Hobby only; do not start a Pro trial or add billing details.
- Neon plan: Free only; confirm the account and project display `Free` before continuing.
- Regions: Neon AWS Frankfurt (`aws-eu-central-1`) and Vercel Frankfurt (`fra1`).
- Database: clean schema only. Never run the demo seed against Neon.
- Messaging: `WHATSAPP_SEND_ENABLED=false`; no Meta token or webhook in this rollout.
- URL: the assigned `*.vercel.app` domain; no custom domain.
- Admin: bootstrap only after the owner provides a real email and a strong password.

Next.js is pinned to 15.5.20 rather than the originally proposed 14.2.35 because the live npm advisory feed now reports high-severity issues across Next.js 14. Prisma remains on 6.x and NextAuth remains on v4.

## Environment matrix

| Variable | Development | Preview | Production |
| --- | --- | --- | --- |
| `DATABASE_URL` | Local PostgreSQL | Pooled Neon preview branch | Pooled Neon primary branch |
| `DIRECT_URL` | Local PostgreSQL | Direct Neon preview branch | Direct Neon primary branch |
| `NEXTAUTH_SECRET` | Local secret | Separate generated secret | Separate generated secret |
| `NEXTAUTH_URL` | `http://localhost:3000` | Stable preview deployment URL | Assigned `vercel.app` URL |
| `CRON_SECRET` | Local secret | Separate generated secret | Separate generated secret |
| `MFA_ENCRYPTION_KEY` | 32 random bytes, Base64 | Separate generated key | Separate generated key |
| `TURNSTILE_SECRET_KEY` | Cloudflare test secret | Cloudflare test secret | Real domain-bound secret |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare test site key | Cloudflare test site key | Real domain-bound site key |
| `RESEND_API_KEY` | Resend test key | Resend test/preview key | Live Resend key |
| `EMAIL_FROM` | Verified development sender | Verified preview sender | Verified customer-domain sender |
| `WHATSAPP_SEND_ENABLED` | `false` | `false` | `false` |

Cloudinary credentials remain optional. When absent, the product form explains that upload is unavailable while retaining HTTPS URL and bundled-image support.

## Local gates

```powershell
npm install
npm audit --omit=dev
npx prisma validate
npx tsc --noEmit --pretty false
npm test
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/livneys_upsale?schema=public'
$env:DIRECT_URL=$env:DATABASE_URL
$env:NEXTAUTH_SECRET='replace-with-at-least-32-characters'
$env:NEXTAUTH_URL='http://localhost:3000'
$env:CRON_SECRET='replace-with-at-least-16-characters'
$env:MFA_ENCRYPTION_KEY='<base64-encoded-32-random-bytes>'
$env:TURNSTILE_SECRET_KEY='<turnstile-secret>'
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY='<turnstile-site-key>'
$env:RESEND_API_KEY='<resend-api-key>'
$env:EMAIL_FROM="Livney's <orders@verified-domain.example>"
$env:WHATSAPP_SEND_ENABLED='false'
npm run deploy:check
npm run build
git diff --check
```

## Create Neon Free resources

Authenticate and verify the selected Neon account is on the Free plan in the browser console before creating anything:

```powershell
npx neonctl@latest auth
npx neonctl@latest me
npx neonctl@latest projects create --name livneys-upsale-eval --region-id aws-eu-central-1 --database livneys --output json
```

Save the returned project ID. Retrieve both connection types without committing or printing them into tickets or logs:

```powershell
npx neonctl@latest connection-string main --project-id <project-id> --pooled --ssl require
npx neonctl@latest connection-string main --project-id <project-id> --ssl require
```

Set the pooled value as `DATABASE_URL` and the direct value as `DIRECT_URL`, then apply migrations. Do not use `prisma db push`.

```powershell
npm run db:migrate:deploy
npx prisma migrate status
npx neonctl@latest branches create --project-id <project-id> --name preview --parent main --output json
npx neonctl@latest connection-string preview --project-id <project-id> --pooled --ssl require
npx neonctl@latest connection-string preview --project-id <project-id> --ssl require
```

The preview branch is created after the primary schema is migrated, so it starts with the same schema and no application data.

## Create and configure Vercel Hobby

Authenticate, confirm the personal scope is Hobby, then create/link the project and connect GitHub:

```powershell
npx vercel@latest login
npx vercel@latest whoami
npx vercel@latest link --yes --project livneys-upsale
npx vercel@latest git connect https://github.com/OfekYosef-D/livneys-upsale.git
```

Add every secret through the interactive prompt so values do not appear in shell history. Use the primary Neon values for `production` and preview-branch values for `preview`.

```powershell
npx vercel@latest env add DATABASE_URL production --sensitive
npx vercel@latest env add DIRECT_URL production --sensitive
npx vercel@latest env add NEXTAUTH_SECRET production --sensitive
npx vercel@latest env add NEXTAUTH_URL production --no-sensitive
npx vercel@latest env add CRON_SECRET production --sensitive
npx vercel@latest env add MFA_ENCRYPTION_KEY production --sensitive
npx vercel@latest env add TURNSTILE_SECRET_KEY production --sensitive
npx vercel@latest env add NEXT_PUBLIC_TURNSTILE_SITE_KEY production --no-sensitive
npx vercel@latest env add RESEND_API_KEY production --sensitive
npx vercel@latest env add EMAIL_FROM production --no-sensitive
npx vercel@latest env add WHATSAPP_SEND_ENABLED production --no-sensitive

npx vercel@latest env add DATABASE_URL preview --sensitive
npx vercel@latest env add DIRECT_URL preview --sensitive
npx vercel@latest env add NEXTAUTH_SECRET preview --sensitive
npx vercel@latest env add NEXTAUTH_URL preview --no-sensitive
npx vercel@latest env add CRON_SECRET preview --sensitive
npx vercel@latest env add MFA_ENCRYPTION_KEY preview --sensitive
npx vercel@latest env add TURNSTILE_SECRET_KEY preview --sensitive
npx vercel@latest env add NEXT_PUBLIC_TURNSTILE_SITE_KEY preview --no-sensitive
npx vercel@latest env add RESEND_API_KEY preview --sensitive
npx vercel@latest env add EMAIL_FROM preview --no-sensitive
npx vercel@latest env add WHATSAPP_SEND_ENABLED preview --no-sensitive
```

Generate independent `NEXTAUTH_SECRET`, `CRON_SECRET`, and `MFA_ENCRYPTION_KEY` values for each environment. Use at least 48 random bytes for NextAuth, 32 for cron, and exactly 32 Base64-encoded random bytes for MFA encryption. Preview may use Cloudflare's documented always-pass test keys; production must use real domain-bound Turnstile keys. Verify the Resend sender before enabling account approvals: setup and reset actions deliberately refuse to report success when no live email channel exists. Set WhatsApp exactly to `false` until Meta credentials and templates are approved.

Password setup and reset URLs are intentionally delivered by email only. A company-wide phone number must never receive a specific user's access token; WhatsApp account-access delivery may be enabled only after the product stores and verifies a phone number for that individual user.

Deploy the feature branch as preview, use its stable branch URL for preview `NEXTAUTH_URL`, and redeploy after setting that URL. Merge only after preview checks pass. Production is deployed from `main`.

```powershell
npx vercel@latest deploy --yes --regions fra1
npx vercel@latest inspect <preview-url>
npx vercel@latest deploy --prod --yes --regions fra1
```

## Safe administrator bootstrap

Do not use `prisma/seed.ts`. After the owner supplies the real credentials, run this locally with the primary Neon URLs:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL='<real-owner-email>'
$env:BOOTSTRAP_ADMIN_NAME='<owner-name>'
$env:BOOTSTRAP_ADMIN_PASSWORD='<strong-unique-password>'
npm run db:bootstrap-admin
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL,Env:BOOTSTRAP_ADMIN_NAME,Env:BOOTSTRAP_ADMIN_PASSWORD
```

The command refuses placeholder credentials and refuses to convert an existing customer account.

## Smoke checks

1. `GET /api/health` returns `200` with `{ "ok": true }`.
2. `/`, `/register`, and `/admin/login` render with Hebrew RTL intact on desktop and mobile.
3. Registration creates only the submitted registration record in Neon.
4. Unauthenticated admin and customer routes redirect or reject access.
5. An invalid cron bearer token returns `401`; the real token returns `200` and creates/processes dry-run records only.
6. Product image upload is visibly unavailable when Cloudinary is absent, while bundled images render.
7. After bootstrap, the real administrator can sign in; no demo user can sign in because no demo seed ran.
8. Both provider dashboards still show Free/Hobby and no paid trial.

## Rollback and later production activation

- Code rollback: `npx vercel@latest rollback <last-known-good-deployment-url>`.
- Database: inspect `npx prisma migrate status`; do not attempt an automatic down migration. Use Neon's Free restore window or a pre-change branch before future schema changes.
- Disable automation by removing the cron entry and redeploying, or keep `WHATSAPP_SEND_ENABLED=false`.
- A commercial launch requires moving off Hobby or upgrading to a Vercel commercial plan. Live WhatsApp also requires a more frequent scheduler, Meta credentials/templates, webhook verification, and a controlled single-recipient smoke test.
