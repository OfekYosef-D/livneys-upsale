BEGIN;

-- Refuse to guess which live order should survive. The pre-deploy audit prints
-- the exact conflicting orders so an operator can reconcile them explicitly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Order"
    WHERE "status" <> 'CANCELLED'
    GROUP BY "customerId", "deliveryWindowStart"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Order integrity migration blocked: duplicate non-cancelled customer delivery windows exist';
  END IF;
END
$$;

ALTER TABLE "Order"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "Order_idempotencyKey_key"
  ON "Order"("idempotencyKey");

CREATE INDEX "Order_customerId_deliveryWindowStart_idx"
  ON "Order"("customerId", "deliveryWindowStart");

CREATE UNIQUE INDEX "Order_one_non_cancelled_per_delivery_window_key"
  ON "Order"("customerId", "deliveryWindowStart")
  WHERE "status" <> 'CANCELLED';

ALTER TABLE "Order"
  DROP CONSTRAINT "Order_customerId_fkey",
  ADD CONSTRAINT "Order_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
