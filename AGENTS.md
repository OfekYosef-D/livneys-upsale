# Livney's B2B Reorder & Upsell Project Rules

- Use modular feature architecture under `features/`.
- Pages should only load data, render UI, and call server actions.
- Business logic belongs in feature modules, not page components.
- Validate all server actions and forms with Zod.
- Enforce admin/customer permissions server-side.
- Preserve Hebrew RTL UI behavior and copy direction.
- Preserve the existing UI/UX direction unless a production requirement forces a focused change.
- Keep the app buildable after each major implementation step.
- Run `npm run build` before finishing.
- Run relevant tests when available.
