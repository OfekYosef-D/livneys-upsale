CREATE TYPE "OrderAdditionRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "OrderAdditionRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderAdditionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "lastMutationKey" TEXT NOT NULL,
    "orderRevisionAtSubmission" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "rejectionReason" TEXT,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentTerm" "PaymentTerm" NOT NULL,
    "paymentDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "paymentDiscountTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vatRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "vatTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalIncludingVat" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderAdditionRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderAdditionLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "listUnitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lineSubtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "promotionId" TEXT,
    "promotionSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderAdditionLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderActivity" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "additionRequestId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderActivity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderLine" ADD COLUMN "additionRequestLineId" TEXT;

CREATE UNIQUE INDEX "OrderAdditionRequest_idempotencyKey_key" ON "OrderAdditionRequest"("idempotencyKey");
CREATE UNIQUE INDEX "OrderAdditionRequest_lastMutationKey_key" ON "OrderAdditionRequest"("lastMutationKey");
CREATE UNIQUE INDEX "OrderAdditionRequest_one_open_per_order_key"
  ON "OrderAdditionRequest"("orderId")
  WHERE "status" IN ('DRAFT', 'PENDING');
CREATE INDEX "OrderAdditionRequest_orderId_status_idx" ON "OrderAdditionRequest"("orderId", "status");
CREATE INDEX "OrderAdditionRequest_customerId_status_idx" ON "OrderAdditionRequest"("customerId", "status");
CREATE INDEX "OrderAdditionRequest_reviewedByUserId_idx" ON "OrderAdditionRequest"("reviewedByUserId");
CREATE INDEX "OrderAdditionRequest_submittedAt_idx" ON "OrderAdditionRequest"("submittedAt");
CREATE INDEX "OrderAdditionLine_requestId_idx" ON "OrderAdditionLine"("requestId");
CREATE INDEX "OrderAdditionLine_productId_idx" ON "OrderAdditionLine"("productId");
CREATE UNIQUE INDEX "OrderLine_additionRequestLineId_key" ON "OrderLine"("additionRequestLineId");
CREATE INDEX "OrderActivity_orderId_createdAt_idx" ON "OrderActivity"("orderId", "createdAt");
CREATE INDEX "OrderActivity_additionRequestId_idx" ON "OrderActivity"("additionRequestId");
CREATE INDEX "OrderActivity_actorUserId_idx" ON "OrderActivity"("actorUserId");

ALTER TABLE "OrderAdditionRequest" ADD CONSTRAINT "OrderAdditionRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderAdditionRequest" ADD CONSTRAINT "OrderAdditionRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderAdditionRequest" ADD CONSTRAINT "OrderAdditionRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderAdditionLine" ADD CONSTRAINT "OrderAdditionLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OrderAdditionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderAdditionLine" ADD CONSTRAINT "OrderAdditionLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_additionRequestLineId_fkey" FOREIGN KEY ("additionRequestLineId") REFERENCES "OrderAdditionLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_additionRequestId_fkey" FOREIGN KEY ("additionRequestId") REFERENCES "OrderAdditionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
