-- ═══════════════════════════════════════════════════════════════════════════════
-- AUDIT FIXES: Soft deletes, CHECK constraints, cascade changes
-- Date: 2026-03-14
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. SOFT DELETE: Invoice (documents fiscaux — ne jamais supprimer physiquement)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "delete_reason" TEXT;
CREATE INDEX IF NOT EXISTS "invoices_is_deleted_status_date_idx" ON "invoices"("is_deleted", "status", "date");

-- 2. SOFT DELETE: ProductMp (traçabilité lots FIFO)
ALTER TABLE "products_mp" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products_mp" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "products_mp" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;
ALTER TABLE "products_mp" ADD COLUMN IF NOT EXISTS "delete_reason" TEXT;
CREATE INDEX IF NOT EXISTS "products_mp_is_deleted_is_active_idx" ON "products_mp"("is_deleted", "is_active");

-- 3. SOFT DELETE: ProductPf (traçabilité lots FIFO)
ALTER TABLE "products_pf" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products_pf" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "products_pf" ADD COLUMN IF NOT EXISTS "deleted_by" TEXT;
ALTER TABLE "products_pf" ADD COLUMN IF NOT EXISTS "delete_reason" TEXT;
CREATE INDEX IF NOT EXISTS "products_pf_is_deleted_is_active_idx" ON "products_pf"("is_deleted", "is_active");

-- 4. CHANGE CASCADE: Payment → Invoice (Cascade → Restrict)
-- Prevent deleting invoices that have payments (fiscal integrity)
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_invoice_id_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. CHECK CONSTRAINTS: Business rules enforced at DB level
-- Recipe: batch weight must be positive
ALTER TABLE "recipes" ADD CONSTRAINT "chk_recipes_batch_weight_positive"
  CHECK ("batch_weight" > 0);

-- Recipe: output quantity must be positive
ALTER TABLE "recipes" ADD CONSTRAINT "chk_recipes_output_quantity_positive"
  CHECK ("output_quantity" > 0);

-- ProductMp: security thresholds must be non-negative
ALTER TABLE "products_mp" ADD CONSTRAINT "chk_products_mp_seuil_securite_non_negative"
  CHECK ("seuil_securite" IS NULL OR "seuil_securite" >= 0);

ALTER TABLE "products_mp" ADD CONSTRAINT "chk_products_mp_seuil_commande_non_negative"
  CHECK ("seuil_commande" IS NULL OR "seuil_commande" >= 0);

ALTER TABLE "products_mp" ADD CONSTRAINT "chk_products_mp_quantite_commande_non_negative"
  CHECK ("quantite_commande" IS NULL OR "quantite_commande" >= 0);

-- Stock movements: quantity must be positive (direction is handled by movementType)
ALTER TABLE "stock_movements" ADD CONSTRAINT "chk_stock_movements_quantity_positive"
  CHECK ("quantity" > 0);

-- Lots: quantities must be non-negative
ALTER TABLE "lots_mp" ADD CONSTRAINT "chk_lots_mp_quantity_initial_non_negative"
  CHECK ("quantity_initial" >= 0);

ALTER TABLE "lots_mp" ADD CONSTRAINT "chk_lots_mp_quantity_remaining_non_negative"
  CHECK ("quantity_remaining" >= 0);

ALTER TABLE "lots_pf" ADD CONSTRAINT "chk_lots_pf_quantity_initial_non_negative"
  CHECK ("quantity_initial" >= 0);

ALTER TABLE "lots_pf" ADD CONSTRAINT "chk_lots_pf_quantity_remaining_non_negative"
  CHECK ("quantity_remaining" >= 0);

-- Invoice: amounts must be non-negative
ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoices_total_ht_non_negative"
  CHECK ("total_ht" >= 0);

ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoices_net_to_pay_non_negative"
  CHECK ("net_to_pay" >= 0);

-- Payments: amount must be positive
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_amount_positive"
  CHECK ("amount" > 0);

-- Invoice lines: quantity and price must be positive
ALTER TABLE "invoice_lines" ADD CONSTRAINT "chk_invoice_lines_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "invoice_lines" ADD CONSTRAINT "chk_invoice_lines_unit_price_non_negative"
  CHECK ("unit_price_ht" >= 0);

-- Production orders: target quantity must be positive
ALTER TABLE "production_orders" ADD CONSTRAINT "chk_production_orders_target_positive"
  CHECK ("target_quantity" > 0);

-- Production orders: batch count must be positive
ALTER TABLE "production_orders" ADD CONSTRAINT "chk_production_orders_batch_count_positive"
  CHECK ("batch_count" > 0);
