# Sequential Order Numbers Design

## Goal

Give every order a short, human-facing, globally increasing number such as `#1001`, while retaining the existing CUID as the internal primary key and route identifier.

## Decisions

- Add `Order.orderNumber` as a unique PostgreSQL-backed integer.
- Begin numbering at `1001`.
- Backfill existing orders chronologically by `createdAt`, using `id` as the deterministic tie-breaker.
- Allocate future numbers from a database sequence so concurrent submissions cannot receive the same number.
- Format the value in one feature helper as `#<number>`.
- Keep the CUID for foreign keys, authorization checks, notification deduplication, and URLs.
- Never use the predictable display number as an authorization boundary.

## Customer-facing behavior

The order number appears on the customer confirmation and in WhatsApp order templates. The opaque order ID may remain in the confirmation URL because it is not rendered and is safer for routing than a predictable sequence.

## Admin behavior

Admin dashboard cards, the selected-order panel, customer order history, the full order page, and notification order labels show the human order number. Links and mutation payloads continue to use the internal ID.

## Visibility audit

- Customer and order IDs are used as hidden form values, React keys, and route parameters; they remain internal and are not rendered as labels.
- Product SKUs are meaningful to staff and are not currently shown in the customer catalog.
- WhatsApp template keys and provider message IDs are retained in admin-only diagnostics because they are useful for support and delivery troubleshooting.
- Notification deduplication keys remain server-only.
- Raw order CUIDs are removed from ordinary admin presentation and customer message content.

## Migration safety

The forward-only migration creates a dedicated sequence, adds the nullable column, backfills deterministic values beginning at `1001`, advances the sequence to the current maximum, sets the sequence as the default, makes the column required, and adds a unique index. Existing primary keys and relationships are unchanged.

## Verification

- Unit tests for formatting, portal mapping, admin mapping, and WhatsApp payloads.
- Full test suite and production build.
- Fresh-database and populated-database migration verification.
- Browser verification in Vercel Preview for two consecutive orders, customer confirmation, admin dashboard/detail, and absence of raw order IDs in rendered order labels.
