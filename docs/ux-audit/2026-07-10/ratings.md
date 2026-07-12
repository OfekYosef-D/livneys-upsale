# Livney's CRM UX Audit - 2026-07-10

## Evidence

- Screenshot root: `docs/ux-audit/2026-07-10/screenshots/`
- Desktop viewport: `1440x1000`
- Mobile viewport: `390x844`
- Machine-readable manifest: `docs/ux-audit/2026-07-10/manifest.json`
- Source guideline used for review: Vercel Web Interface Guidelines, especially labels, focus states, form names/autocomplete, long text handling, image sizing, and modal behavior.

## Rubric

Scores are `1-10`.

- **Task effort:** steps, fields, and cognitive decisions needed to create/control an item.
- **Operator clarity:** Hebrew copy, hierarchy, and whether a non-technical owner understands the next action.
- **UI quality:** spacing, density, alignment, RTL behavior, responsiveness, and modal ergonomics.
- **Product usefulness:** fit for Livney's institutional order, customer, price, route, notification, and product workflows.
- **Accessibility/testability:** labels, focus states, keyboard flow, actionable errors, stable form names, and feedback regions.

Overall rule: `9-10` ready, `8` acceptable with minor polish, `6-7` improve before handoff, `<6` redesign before shipping.

## Fixes Applied During Audit

- Replaced owner-internal copy in the product modal: `תבניות מוצר לפי תשובות הבעלים` is now `תבניות מוצר מהירות`.
- Added operator-facing helper copy to product presets so the owner understands that presets fill price, minimum quantity, and order multiples.
- Added page-level horizontal overflow protection and reset screenshot scroll state before each capture.
- Improved modal overscroll behavior, focus-visible states on shared CRM controls, decorative icon semantics, and `aria-live` feedback for form messages.
- Improved product image preview/upload semantics with file input name, explicit image dimensions, upload feedback, and clearer URL placeholder.
- Replaced visible loading `...` with Hebrew UI ellipsis where touched.

## Ratings

| Area | Slug | Task Effort | Operator Clarity | UI Quality | Product Usefulness | A11y/Testability | Overall | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| Public/auth | `home` | 8.0 | 8.2 | 8.0 | 8.0 | 8.0 | 8.0 | acceptable | Public entry is simple; screenshot mirrors the customer login surface. |
| Public/auth | `customer-login` | 8.4 | 8.5 | 8.2 | 8.4 | 8.2 | 8.3 | ready | Clear low-friction customer login. |
| Public/auth | `register` | 8.5 | 8.5 | 8.2 | 8.6 | 8.1 | 8.4 | ready | Good lead capture; public self-activation is correctly avoided. |
| Public/auth | `admin-login` | 8.4 | 8.5 | 8.2 | 8.4 | 8.2 | 8.3 | ready | Clear admin-only entry point. |
| Admin | `admin-dashboard` | 8.6 | 8.7 | 8.4 | 8.8 | 8.2 | 8.5 | ready | Strong operator desk with clear next actions. |
| Admin | `manual-order` | 8.0 | 8.1 | 8.1 | 8.5 | 8.0 | 8.1 | acceptable | Dense, but it supports the real phone/WhatsApp order workflow. |
| Admin | `manual-order-state` | 8.2 | 8.2 | 8.1 | 8.6 | 8.0 | 8.2 | acceptable | Customer-selected state is workable; product filtering keeps effort controlled. |
| Admin CRM | `customers` | 8.6 | 8.6 | 8.4 | 8.6 | 8.2 | 8.5 | ready | List-first CRM control is clear. |
| Admin CRM | `customers-create-modal` | 8.4 | 8.5 | 8.2 | 8.6 | 8.2 | 8.4 | ready | Common fields first; accounting and internal fields stay advanced. |
| Admin CRM | `customers-edit-modal` | 8.4 | 8.5 | 8.2 | 8.6 | 8.2 | 8.4 | ready | Same structure works for maintenance. |
| Admin CRM | `registrations` | 8.2 | 8.5 | 8.0 | 8.7 | 8.2 | 8.3 | ready | Desktop clipping from first capture is fixed; single lead sits right-aligned in RTL layout. |
| Admin CRM | `registrations-conversion-card` | 8.4 | 8.5 | 8.1 | 8.8 | 8.3 | 8.4 | ready | Route, price list, and temporary password are visible in one conversion action. |
| Admin CRM | `routes` | 8.2 | 8.2 | 8.1 | 8.4 | 8.0 | 8.2 | acceptable | Operationally useful; weekday number fields remain a small cognitive cost. |
| Admin CRM | `routes-create-modal` | 8.0 | 8.1 | 8.0 | 8.3 | 8.0 | 8.1 | acceptable | Defaults help, but weekday numeric mapping is still mildly technical. |
| Admin CRM | `routes-edit-modal` | 8.0 | 8.1 | 8.0 | 8.3 | 8.0 | 8.1 | acceptable | Good enough for handoff; future polish could use weekday names. |
| Admin CRM | `notifications` | 8.0 | 8.2 | 8.0 | 8.5 | 8.0 | 8.1 | acceptable | Good operational overview; technical error strings are necessary but dense. |
| Admin CRM | `notifications-state` | 8.0 | 8.1 | 8.0 | 8.6 | 8.0 | 8.1 | acceptable | Technical sections are tucked lower on the page and reviewable. |
| Admin CRM | `products` | 8.2 | 8.3 | 8.2 | 8.7 | 8.1 | 8.3 | ready | Product cards are visual and searchable; long catalog is manageable. |
| Admin CRM | `products-create-modal` | 8.0 | 8.4 | 8.0 | 8.7 | 8.2 | 8.2 | acceptable | Presets, SKU auto-generation, image upload, and order multiple reduce effort; sticky footer is minor polish. |
| Admin CRM | `products-edit-modal` | 8.0 | 8.3 | 8.0 | 8.6 | 8.2 | 8.1 | acceptable | Image and technical asset fields are separated enough for maintainability. |
| Admin CRM | `price-lists` | 8.1 | 8.2 | 8.1 | 8.6 | 8.0 | 8.2 | acceptable | Summary cards and clone action make price-list control understandable. |
| Admin CRM | `price-lists-create-modal` | 8.0 | 8.0 | 8.0 | 8.5 | 8.0 | 8.1 | acceptable | Many price fields are unavoidable; default product prices and clone flow reduce risk. |
| Admin CRM | `price-lists-clone-modal` | 8.8 | 8.8 | 8.4 | 8.8 | 8.2 | 8.6 | ready | Best path for creating a new price list quickly. |
| Admin CRM | `price-lists-edit-modal` | 8.0 | 8.0 | 8.0 | 8.5 | 8.0 | 8.1 | acceptable | Dense but structured; prices are scoped to one scrollable list. |
| Admin CRM | `promotions` | 8.2 | 8.3 | 8.1 | 8.5 | 8.1 | 8.2 | acceptable | Presets align with cash and winery quantity discount needs. |
| Admin CRM | `promotions-create-modal` | 8.2 | 8.4 | 8.1 | 8.6 | 8.1 | 8.3 | ready | Presets reduce setup effort without changing pricing engine contracts. |
| Admin CRM | `promotions-edit-modal` | 8.1 | 8.3 | 8.1 | 8.5 | 8.1 | 8.2 | acceptable | Scope checkboxes are dense but expected for promotion control. |
| Admin CRM | `recommendations` | 8.1 | 8.2 | 8.0 | 8.3 | 8.0 | 8.1 | acceptable | Useful simple upsell mapping. |
| Admin CRM | `recommendations-create-modal` | 8.5 | 8.4 | 8.2 | 8.4 | 8.1 | 8.3 | ready | Low field count and clear creation flow. |
| Admin CRM | `recommendations-edit-modal` | 8.4 | 8.4 | 8.2 | 8.4 | 8.1 | 8.3 | ready | Maintains the same low-friction flow. |
| Detail | `customer-detail` | 8.2 | 8.2 | 8.0 | 8.4 | 8.0 | 8.2 | acceptable | Good summary/history view; future polish could add direct edit shortcut. |
| Detail | `route-detail` | 8.0 | 8.1 | 8.0 | 8.3 | 8.0 | 8.1 | acceptable | Useful route-level operations view. |
| Detail | `order-detail` | 8.5 | 8.5 | 8.2 | 8.7 | 8.1 | 8.4 | ready | Clear order status and line-item context. |
| Customer flow | `customer-catalog` | 8.4 | 8.4 | 8.3 | 8.7 | 8.1 | 8.4 | ready | Visual catalog supports repeat ordering and package constraints. |
| Customer flow | `customer-review` | 8.2 | 8.3 | 8.1 | 8.6 | 8.1 | 8.3 | ready | Review is clear and minimum/order-multiple constraints are testable. |
| Customer flow | `customer-confirmation` | 8.6 | 8.6 | 8.3 | 8.7 | 8.1 | 8.5 | ready | Confirmation is concise and reassuring without extra cognitive load. |

## Remaining Minor Polish

- Product and price-list modals keep actions visible with a sticky footer. It improves save/cancel access but can cover the bottom edge of a long form viewport until the user scrolls slightly.
- Route weekday fields still use numeric mapping. A future enhancement could replace them with weekday selects.
- Price-list creation still requires reviewing many product prices. The clone flow should be the recommended operational path for new customer-specific pricing.

## Outcome

All core admin creation/control workflows are now scored `8/10` or higher after the recapture. The remaining issues are polish-level and do not block handoff.
