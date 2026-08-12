-- Production security, legal acceptance, receipts, and dated VAT configuration.
-- Forward-only: this migration does not delete or rewrite products, prices, orders, or customers.

CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHECK', 'CREDIT_CARD', 'OTHER');
CREATE TYPE "PaymentReceiptStatus" AS ENUM ('RECORDED', 'VOIDED');
CREATE TYPE "LegalDocumentType" AS ENUM ('COMMERCIAL_TERMS', 'PRIVACY_POLICY', 'CANCELLATION_RETURNS');

CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "PaymentReceiptStatus" NOT NULL DEFAULT 'RECORDED',
    "recordedByUserId" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentReceipt_positive_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "PaymentReceipt_void_state_check" CHECK (
      ("status" = 'RECORDED' AND "voidedAt" IS NULL AND "voidedByUserId" IS NULL AND "voidReason" IS NULL)
      OR
      ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND "voidedByUserId" IS NOT NULL AND LENGTH(TRIM("voidReason")) > 0)
    )
);

CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "LegalDocumentType" NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TaxRate_percent_check" CHECK ("ratePercent" >= 0 AND "ratePercent" <= 100),
    CONSTRAINT "TaxRate_window_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "customerId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentReceipt_orderId_status_receivedAt_idx" ON "PaymentReceipt"("orderId", "status", "receivedAt");
CREATE INDEX "PaymentReceipt_recordedByUserId_idx" ON "PaymentReceipt"("recordedByUserId");
CREATE INDEX "PaymentReceipt_voidedByUserId_idx" ON "PaymentReceipt"("voidedByUserId");
CREATE UNIQUE INDEX "LegalAcceptance_orderId_documentType_key" ON "LegalAcceptance"("orderId", "documentType");
CREATE INDEX "LegalAcceptance_customerId_acceptedAt_idx" ON "LegalAcceptance"("customerId", "acceptedAt");
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt");
CREATE UNIQUE INDEX "TaxRate_jurisdiction_effectiveFrom_key" ON "TaxRate"("jurisdiction", "effectiveFrom");
CREATE INDEX "TaxRate_jurisdiction_effectiveFrom_effectiveTo_idx" ON "TaxRate"("jurisdiction", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "TaxRate_one_open_per_jurisdiction_key" ON "TaxRate"("jurisdiction") WHERE "effectiveTo" IS NULL;
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_customerId_createdAt_idx" ON "AuditLog"("customerId", "createdAt");
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_immutable_record_change()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% records are append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_prevent_update_delete"
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_record_change();

CREATE TRIGGER "LegalAcceptance_prevent_update_delete"
BEFORE UPDATE OR DELETE ON "LegalAcceptance"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_record_change();

INSERT INTO "TaxRate" ("id", "jurisdiction", "label", "ratePercent", "effectiveFrom", "effectiveTo")
VALUES ('israel-standard-2025-01-01', 'IL', 'מע״מ ישראלי תקני', 18.00, '2025-01-01T00:00:00.000Z', NULL);
