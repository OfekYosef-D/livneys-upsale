ALTER TABLE "Order"
  ADD COLUMN "vatRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 18,
  ADD COLUMN "vatTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalIncludingVat" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "commercialTermsVersion" TEXT,
  ADD COLUMN "commercialTermsAcceptedAt" TIMESTAMP(3);

-- All current orders were created after the standard VAT rate changed to 18%
-- on 2025-01-01. Preserve the net total and add a historical tax snapshot.
-- Product, price-list, price-list-item, and order-line rows are not modified.
UPDATE "Order"
SET
  "vatRatePercent" = 18,
  "vatTotal" = ROUND("total" * 0.18, 2),
  "totalIncludingVat" = "total" + ROUND("total" * 0.18, 2);
