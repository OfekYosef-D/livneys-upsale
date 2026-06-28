-- CreateEnum
CREATE TYPE "PromotionEffectType" AS ENUM ('DISPLAY_ONLY', 'PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FIXED_UNIT_PRICE', 'BUY_X_GET_Y');

-- Order snapshots
ALTER TABLE "Order" ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "discountTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
UPDATE "Order" SET "subtotal" = "total", "discountTotal" = 0;

ALTER TABLE "OrderLine" ADD COLUMN "listUnitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "OrderLine" ADD COLUMN "lineSubtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "OrderLine" ADD COLUMN "discountTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "OrderLine" ADD COLUMN "promotionId" TEXT;
ALTER TABLE "OrderLine" ADD COLUMN "promotionSnapshot" JSONB;
UPDATE "OrderLine" SET "listUnitPrice" = "unitPrice", "lineSubtotal" = "lineTotal", "discountTotal" = 0;

-- Promotion engine fields
ALTER TABLE "Promotion" ADD COLUMN "effectType" "PromotionEffectType" NOT NULL DEFAULT 'DISPLAY_ONLY';
ALTER TABLE "Promotion" ADD COLUMN "discountValue" DECIMAL(10,2);
ALTER TABLE "Promotion" ADD COLUMN "buyQuantity" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN "freeQuantity" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Promotion" DROP CONSTRAINT "Promotion_productId_fkey";
ALTER TABLE "Promotion" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Normalized targets
CREATE TABLE "PromotionProductTarget" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionProductTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCategoryTarget" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionCategoryTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCustomerTarget" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionCustomerTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionRouteTarget" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionRouteTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionPriceListTarget" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionPriceListTarget_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PromotionProductTarget" ("id", "promotionId", "productId")
SELECT 'ppt_' || "id" || '_' || "productId", "id", "productId"
FROM "Promotion"
WHERE "productId" IS NOT NULL;

-- Indexes and constraints
CREATE INDEX "OrderLine_promotionId_idx" ON "OrderLine"("promotionId");
CREATE INDEX "Promotion_effectType_idx" ON "Promotion"("effectType");
CREATE INDEX "Promotion_priority_idx" ON "Promotion"("priority");

CREATE UNIQUE INDEX "PromotionProductTarget_promotionId_productId_key" ON "PromotionProductTarget"("promotionId", "productId");
CREATE INDEX "PromotionProductTarget_productId_idx" ON "PromotionProductTarget"("productId");

CREATE UNIQUE INDEX "PromotionCategoryTarget_promotionId_category_key" ON "PromotionCategoryTarget"("promotionId", "category");
CREATE INDEX "PromotionCategoryTarget_category_idx" ON "PromotionCategoryTarget"("category");

CREATE UNIQUE INDEX "PromotionCustomerTarget_promotionId_customerId_key" ON "PromotionCustomerTarget"("promotionId", "customerId");
CREATE INDEX "PromotionCustomerTarget_customerId_idx" ON "PromotionCustomerTarget"("customerId");

CREATE UNIQUE INDEX "PromotionRouteTarget_promotionId_routeId_key" ON "PromotionRouteTarget"("promotionId", "routeId");
CREATE INDEX "PromotionRouteTarget_routeId_idx" ON "PromotionRouteTarget"("routeId");

CREATE UNIQUE INDEX "PromotionPriceListTarget_promotionId_priceListId_key" ON "PromotionPriceListTarget"("promotionId", "priceListId");
CREATE INDEX "PromotionPriceListTarget_priceListId_idx" ON "PromotionPriceListTarget"("priceListId");

ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromotionProductTarget" ADD CONSTRAINT "PromotionProductTarget_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionProductTarget" ADD CONSTRAINT "PromotionProductTarget_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionCategoryTarget" ADD CONSTRAINT "PromotionCategoryTarget_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionCustomerTarget" ADD CONSTRAINT "PromotionCustomerTarget_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionCustomerTarget" ADD CONSTRAINT "PromotionCustomerTarget_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRouteTarget" ADD CONSTRAINT "PromotionRouteTarget_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRouteTarget" ADD CONSTRAINT "PromotionRouteTarget_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionPriceListTarget" ADD CONSTRAINT "PromotionPriceListTarget_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionPriceListTarget" ADD CONSTRAINT "PromotionPriceListTarget_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
