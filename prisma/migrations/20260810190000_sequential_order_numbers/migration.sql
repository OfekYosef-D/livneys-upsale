CREATE SEQUENCE "Order_orderNumber_seq"
  START WITH 1001
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE "Order"
  ADD COLUMN "orderNumber" INTEGER;

WITH numbered_orders AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt", "id") + 1000 AS "orderNumber"
  FROM "Order"
)
UPDATE "Order"
SET "orderNumber" = numbered_orders."orderNumber"
FROM numbered_orders
WHERE "Order"."id" = numbered_orders."id";

SELECT setval(
  '"Order_orderNumber_seq"',
  COALESCE((SELECT MAX("orderNumber") FROM "Order"), 1000),
  true
);

ALTER TABLE "Order"
  ALTER COLUMN "orderNumber" SET DEFAULT nextval('"Order_orderNumber_seq"'),
  ALTER COLUMN "orderNumber" SET NOT NULL;

ALTER SEQUENCE "Order_orderNumber_seq"
  OWNED BY "Order"."orderNumber";

CREATE UNIQUE INDEX "Order_orderNumber_key"
  ON "Order"("orderNumber");
