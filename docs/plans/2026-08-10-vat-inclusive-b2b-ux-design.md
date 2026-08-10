# VAT-Inclusive B2B Order UX Design

## Goal

Turn VAT from a disclaimer into a complete, auditable part of the institutional ordering flow. Customers should always understand the net amount, VAT amount, and actual gross amount, while Livney's retains a historical snapshot of the tax calculation and the customer's B2B declaration.

## Product direction

Use a restrained commercial-document aesthetic that extends the existing warm, minimal Livney's interface. Product cards remain focused on net institutional unit prices. Decision points—cart summary, order review, confirmation, and admin order views—show a structured financial breakdown where the gross amount is the visually dominant number.

The catalog continues to label prices as excluding VAT because it is a closed B2B price list. The bottom cart bar adds a secondary gross estimate so buyers do not have to calculate the real payable amount. The review and confirmation screens display all of the following in order:

1. List-price subtotal.
2. Product promotions.
3. Immediate-payment discount, when selected.
4. Total excluding VAT.
5. VAT rate and amount.
6. Total including VAT as the primary amount.

Currency values display agorot when present instead of rounding `16.90` to `17`.

## Legal and commercial clarity

The portal is explicitly positioned as intended for business and institutional customers purchasing in the course of business. Before a customer submits an order, they must affirm that the order is commercial/institutional and that the products, quantities, payment terms, and displayed net/VAT/gross totals are correct.

The order stores the declaration version and acceptance timestamp. The UI also states that submission is a request for approval, not a tax invoice; supply is subject to availability and final company approval; and the tax invoice will be issued according to law. These are product safeguards and an audit trail, not a substitute for counsel reviewing the company's complete terms, privacy policy, cancellation rules, and invoice workflow.

## Data model and historical integrity

Each order stores:

- `vatRatePercent`: the rate applied at submission.
- `vatTotal`: the VAT amount rounded to agorot.
- `totalIncludingVat`: the final gross amount.
- `commercialTermsVersion`: the declaration copy version, only for customer-submitted orders.
- `commercialTermsAcceptedAt`: the acceptance timestamp, only for customer-submitted orders.

The existing `total` field remains the net amount after all discounts. Product and price-list records are never modified. Existing orders are backfilled using the current 18% rate because all current production orders were created after that rate took effect; manual/admin orders retain null declaration fields.

The calculation runs only on the server when an order is submitted. Client-side calculation is a preview using the same pure domain helper. Historical confirmation and admin screens read the stored snapshot rather than recalculating from the current VAT constant.

## Error handling and accessibility

- Zod rejects customer submissions unless `commercialTermsAccepted` is literally `true`.
- The server independently rejects a customer-sourced order without acceptance.
- The submit button stays disabled until the declaration is checked.
- The checkbox uses a visible label and focus state; financial rows use semantic text, tabular numbers, and sufficient contrast.
- Manual admin orders remain available and are clearly shown as having no customer declaration.

## Verification

- Unit tests for VAT rounding, currency formatting, declaration validation, server payload snapshots, portal mapping, and admin mapping.
- Forward-only migration verification on a populated database.
- Pre/post hashes for `Product`, `PriceList`, and `PriceListItem` in Production.
- Full tests, production build, dependency audit, and browser QA on desktop and mobile Preview.

