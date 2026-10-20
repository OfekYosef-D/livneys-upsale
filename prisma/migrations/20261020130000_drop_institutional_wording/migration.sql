-- Every customer is institutional, so "מוסדי" adds nothing to names shown to customers.
-- 500 g products are named by size instead, which keeps them distinct from their smaller twins.
UPDATE "Product"
SET "name" = regexp_replace("name", '\s*מוסדי$', ' 500 גרם'), "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" ~ '\s*מוסדי$';

UPDATE "Product"
SET "description" = replace("description", 'גרסת מוסדי 500 גרם', 'צנצנת 500 גרם'), "updatedAt" = CURRENT_TIMESTAMP
WHERE "description" LIKE '%גרסת מוסדי 500 גרם%';

UPDATE "PriceList"
SET "name" = 'מחירון סטנדרטי', "description" = 'מחירי בסיס', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'מחירון מוסדי סטנדרטי';
