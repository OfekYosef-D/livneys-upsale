-- Every customer is institutional, so a separate "מוסדי" category only split the catalog.
-- Each 500 g product moves to the category of its smaller twin (same name without " מוסדי").
UPDATE "Product" AS large
SET "category" = twin."category", "updatedAt" = CURRENT_TIMESTAMP
FROM "Product" AS twin
WHERE large."category" = 'מוסדי'
  AND twin."category" <> 'מוסדי'
  AND twin."name" = regexp_replace(large."name", '\s*מוסדי$', '');

-- A 500 g product without a twin still leaves the old category.
UPDATE "Product"
SET "category" = 'ממרחים', "updatedAt" = CURRENT_TIMESTAMP
WHERE "category" = 'מוסדי';
