-- AlterTable: recipes
ALTER TABLE "recipes" ALTER COLUMN "loss_tolerance" SET DATA TYPE DECIMAL(18,4);

-- AlterTable: recipe_items
ALTER TABLE "recipe_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "recipe_items" ALTER COLUMN "unit_cost" SET DATA TYPE DECIMAL(18,4);

-- AlterTable: production_orders
ALTER TABLE "production_orders" ALTER COLUMN "yield_percentage" SET DATA TYPE DECIMAL(18,4);

-- AlterTable: production_consumptions
ALTER TABLE "production_consumptions" ALTER COLUMN "quantity_planned" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "production_consumptions" ALTER COLUMN "quantity_consumed" SET DATA TYPE DECIMAL(18,4);

-- AlterTable: inventory_declarations
ALTER TABLE "inventory_declarations" ALTER COLUMN "theoretical_stock" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "inventory_declarations" ALTER COLUMN "declared_stock" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "inventory_declarations" ALTER COLUMN "difference" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "inventory_declarations" ALTER COLUMN "difference_percent" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "inventory_declarations" ALTER COLUMN "difference_value" SET DATA TYPE DECIMAL(18,4);

-- AlterTable: purchase_orders
ALTER TABLE "purchase_orders" ALTER COLUMN "total_ht" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "purchase_orders" ALTER COLUMN "expected_total_qty" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "purchase_orders" ALTER COLUMN "received_total_qty" SET DATA TYPE DECIMAL(18,4);

-- AlterTable: purchase_order_items
ALTER TABLE "purchase_order_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "purchase_order_items" ALTER COLUMN "quantity_received" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "purchase_order_items" ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "purchase_order_items" ALTER COLUMN "total_ht" SET DATA TYPE DECIMAL(18,4);

-- AlterTable: demandes_appro_lignes
ALTER TABLE "demandes_appro_lignes" ALTER COLUMN "quantite_demandee" SET DATA TYPE DECIMAL(18,4);
ALTER TABLE "demandes_appro_lignes" ALTER COLUMN "quantite_validee" SET DATA TYPE DECIMAL(18,4);
