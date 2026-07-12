-- Existing products should keep their current package/minimum ordering behavior
-- after the new orderMultiple column is introduced.

UPDATE "Product"
SET "orderMultiple" = GREATEST("minQty", 1)
WHERE "orderMultiple" = 1
  AND "minQty" > 1;
