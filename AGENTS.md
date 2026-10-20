# Livney's B2B Reorder & Upsell Project Rules

- Use modular feature architecture under `features/` (see README "Architecture").
- Pages should only authorize, load data, render UI, and call server actions.
- Business logic belongs in feature modules, not page components.
- Every server action is built with `adminAction` / `customerAction` / `publicAction` from `lib/server-action.ts` and validated with Zod (`lib/validation.ts`).
- Enforce admin/customer permissions server-side.
- Expected failures throw `AppError` (lib/errors.ts) with a Hebrew message; never expose raw errors.
- Format and parse user-facing dates with `lib/datetime.ts` (Israel time) and money with `lib/money.ts`.
- Reuse `components/ui/*` and `useServerAction` instead of re-implementing buttons, fields, dialogs or pending state.
- Preserve Hebrew RTL UI behavior and copy direction.
- Preserve the existing UI/UX direction unless a production requirement forces a focused change.
- Keep the app buildable after each major implementation step.
- Run `npm run build` before finishing.
- Run relevant tests (`npm test`); tests mock Prisma with `test/prisma-mock.ts`.
