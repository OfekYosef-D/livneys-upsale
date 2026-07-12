-- Owner response CRM hardening: lead queue, customer metadata, and carton-order rules.

CREATE TYPE "CompanyRegistrationStatus" AS ENUM ('PENDING', 'CONTACTED', 'CONVERTED', 'ARCHIVED');

ALTER TABLE "Customer" ADD COLUMN "invoiceName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "accountingContactName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "accountingEmail" TEXT;
ALTER TABLE "Customer" ADD COLUMN "accountingPhone" TEXT;
ALTER TABLE "Customer" ADD COLUMN "businessType" TEXT;
ALTER TABLE "Customer" ADD COLUMN "deliveryConstraints" TEXT;

ALTER TABLE "Product" ADD COLUMN "orderMultiple" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "CompanyRegistrationRequest" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "invoiceName" TEXT,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accountingContactName" TEXT,
    "accountingEmail" TEXT,
    "accountingPhone" TEXT,
    "businessType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "deliveryNotes" TEXT,
    "openingOrderNotes" TEXT,
    "status" "CompanyRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "internalNote" TEXT,
    "convertedCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyRegistrationRequest_status_createdAt_idx" ON "CompanyRegistrationRequest"("status", "createdAt");
CREATE INDEX "CompanyRegistrationRequest_businessName_idx" ON "CompanyRegistrationRequest"("businessName");
CREATE INDEX "CompanyRegistrationRequest_email_idx" ON "CompanyRegistrationRequest"("email");
