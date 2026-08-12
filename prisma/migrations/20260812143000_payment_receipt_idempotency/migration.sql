-- Existing receipts remain valid with a NULL key. Every new receipt created by
-- the application carries a UUID, and PostgreSQL permits multiple NULL values
-- while enforcing uniqueness for all populated keys.
ALTER TABLE "PaymentReceipt" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "PaymentReceipt_idempotencyKey_key"
ON "PaymentReceipt"("idempotencyKey");
