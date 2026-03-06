-- Fix NULL values in last_physical_stock columns
-- These columns were added without NOT NULL DEFAULT in migration 20250128
-- but the Prisma schema declares them as non-nullable Decimal @default(0)

-- Fix products_mp
UPDATE "products_mp" SET "last_physical_stock" = 0 WHERE "last_physical_stock" IS NULL;
ALTER TABLE "products_mp" ALTER COLUMN "last_physical_stock" SET DEFAULT 0;
ALTER TABLE "products_mp" ALTER COLUMN "last_physical_stock" SET NOT NULL;
ALTER TABLE "products_mp" ALTER COLUMN "last_physical_stock" SET DATA TYPE DECIMAL(15, 4);

-- Fix products_pf
UPDATE "products_pf" SET "last_physical_stock" = 0 WHERE "last_physical_stock" IS NULL;
ALTER TABLE "products_pf" ALTER COLUMN "last_physical_stock" SET DEFAULT 0;
ALTER TABLE "products_pf" ALTER COLUMN "last_physical_stock" SET NOT NULL;
ALTER TABLE "products_pf" ALTER COLUMN "last_physical_stock" SET DATA TYPE DECIMAL(15, 4);
