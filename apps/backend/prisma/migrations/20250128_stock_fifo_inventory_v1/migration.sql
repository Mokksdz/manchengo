-- Migration: stock_fifo_inventory_v1
-- Date: 2025-01-28
-- Description: FIFO, blocage lots DLC, inventaire sécurisé

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ENUM LotStatus
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'BLOCKED', 'CONSUMED');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. ENUM InventoryStatus & InventoryRiskLevel
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE "InventoryStatus" AS ENUM (
  'PENDING_ANALYSIS',
  'AUTO_APPROVED',
  'PENDING_VALIDATION',
  'PENDING_DOUBLE_VALIDATION',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE "InventoryRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ALTER lots_mp - Ajout champs FIFO et blocage
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "lots_mp" ADD COLUMN "status" "LotStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "lots_mp" ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "lots_mp" ADD COLUMN "blocked_reason" TEXT;
ALTER TABLE "lots_mp" ADD COLUMN "blocked_by_id" TEXT;
ALTER TABLE "lots_mp" ADD COLUMN "consumed_at" TIMESTAMP(3);

-- Index FIFO optimisé
CREATE INDEX "idx_lots_mp_fifo" ON "lots_mp"("product_id", "status", "created_at", "expiry_date");

-- Contrainte quantité positive
ALTER TABLE "lots_mp" ADD CONSTRAINT "chk_lots_mp_qty_positive" CHECK ("quantity_remaining" >= 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. ALTER lots_pf - Ajout champs FIFO et blocage
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "lots_pf" ADD COLUMN "status" "LotStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "lots_pf" ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "lots_pf" ADD COLUMN "blocked_reason" TEXT;
ALTER TABLE "lots_pf" ADD COLUMN "blocked_by_id" TEXT;
ALTER TABLE "lots_pf" ADD COLUMN "consumed_at" TIMESTAMP(3);

-- Index FIFO optimisé
CREATE INDEX "idx_lots_pf_fifo" ON "lots_pf"("product_id", "status", "created_at", "expiry_date");

-- Contrainte quantité positive
ALTER TABLE "lots_pf" ADD CONSTRAINT "chk_lots_pf_qty_positive" CHECK ("quantity_remaining" >= 0);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. ALTER products_mp - Ajout champs stock physique et périssabilité
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "products_mp" ADD COLUMN "is_perishable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products_mp" ADD COLUMN "last_physical_stock" DOUBLE PRECISION;
ALTER TABLE "products_mp" ADD COLUMN "last_physical_stock_date" TIMESTAMP(3);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. ALTER products_pf - Ajout champs stock physique
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "products_pf" ADD COLUMN "last_physical_stock" DOUBLE PRECISION;
ALTER TABLE "products_pf" ADD COLUMN "last_physical_stock_date" TIMESTAMP(3);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. ALTER stock_movements - Ajout idempotence et traçabilité
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "stock_movements" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "lot_snapshot" JSONB;
ALTER TABLE "stock_movements" ADD COLUMN "inventory_declaration_id" INTEGER;

-- Index unique pour idempotence
CREATE UNIQUE INDEX "stock_movements_idempotency_key_key" ON "stock_movements"("idempotency_key");
CREATE INDEX "stock_movements_idempotency_key_idx" ON "stock_movements"("idempotency_key");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. CREATE TABLE inventory_declarations
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE "inventory_declarations" (
  "id" SERIAL NOT NULL,
  "product_type" "ProductType" NOT NULL,
  "product_mp_id" INTEGER,
  "product_pf_id" INTEGER,
  "theoretical_stock" DOUBLE PRECISION NOT NULL,
  "declared_stock" DOUBLE PRECISION NOT NULL,
  "difference" DOUBLE PRECISION NOT NULL,
  "difference_percent" DOUBLE PRECISION NOT NULL,
  "difference_value" DOUBLE PRECISION NOT NULL,
  "risk_level" "InventoryRiskLevel" NOT NULL,
  "status" "InventoryStatus" NOT NULL DEFAULT 'PENDING_ANALYSIS',
  "counted_by_id" TEXT NOT NULL,
  "counted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "evidence_photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "first_validator_id" TEXT,
  "first_validated_at" TIMESTAMP(3),
  "first_validation_reason" TEXT,
  "validated_by_id" TEXT,
  "validated_at" TIMESTAMP(3),
  "validation_reason" TEXT,
  "rejected_by_id" TEXT,
  "rejected_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "expired_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inventory_declarations_pkey" PRIMARY KEY ("id")
);

-- Index pour inventory_declarations
CREATE INDEX "inventory_declarations_product_type_product_mp_id_idx" ON "inventory_declarations"("product_type", "product_mp_id");
CREATE INDEX "inventory_declarations_product_type_product_pf_id_idx" ON "inventory_declarations"("product_type", "product_pf_id");
CREATE INDEX "inventory_declarations_status_idx" ON "inventory_declarations"("status");
CREATE INDEX "inventory_declarations_counted_by_id_counted_at_idx" ON "inventory_declarations"("counted_by_id", "counted_at");
CREATE INDEX "inventory_declarations_risk_level_status_idx" ON "inventory_declarations"("risk_level", "status");

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. FOREIGN KEYS
-- ═══════════════════════════════════════════════════════════════════════════════

-- inventory_declarations
ALTER TABLE "inventory_declarations" ADD CONSTRAINT "inventory_declarations_counted_by_id_fkey" 
  FOREIGN KEY ("counted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_declarations" ADD CONSTRAINT "inventory_declarations_first_validator_id_fkey" 
  FOREIGN KEY ("first_validator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_declarations" ADD CONSTRAINT "inventory_declarations_validated_by_id_fkey" 
  FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_declarations" ADD CONSTRAINT "inventory_declarations_rejected_by_id_fkey" 
  FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- stock_movements -> inventory_declarations
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_declaration_id_fkey" 
  FOREIGN KEY ("inventory_declaration_id") REFERENCES "inventory_declarations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. TRIGGER - Empêcher consommation lot BLOCKED (ajustement T2 + F2)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_blocked_lot_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le lot est BLOCKED et qu'on essaie de réduire la quantité
  IF OLD.status = 'BLOCKED' AND NEW.quantity_remaining < OLD.quantity_remaining THEN
    RAISE EXCEPTION 'Cannot consume from BLOCKED lot %. Reason: %', OLD.id, OLD.blocked_reason;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_blocked_lot_mp_consumption
  BEFORE UPDATE ON lots_mp
  FOR EACH ROW EXECUTE FUNCTION prevent_blocked_lot_consumption();

CREATE TRIGGER trg_prevent_blocked_lot_pf_consumption
  BEFORE UPDATE ON lots_pf
  FOR EACH ROW EXECUTE FUNCTION prevent_blocked_lot_consumption();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. Mise à jour lots existants (status = AVAILABLE si quantité > 0, CONSUMED sinon)
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE "lots_mp" SET "status" = 'CONSUMED', "consumed_at" = NOW() WHERE "quantity_remaining" <= 0;
UPDATE "lots_pf" SET "status" = 'CONSUMED', "consumed_at" = NOW() WHERE "quantity_remaining" <= 0;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. Blocage automatique lots DLC dépassée (exécution unique initiale)
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE "lots_mp" 
SET "status" = 'BLOCKED', 
    "blocked_at" = NOW(), 
    "blocked_reason" = 'DLC_EXPIRED_MIGRATION'
WHERE "expiry_date" < NOW() 
  AND "status" = 'AVAILABLE';

UPDATE "lots_pf" 
SET "status" = 'BLOCKED', 
    "blocked_at" = NOW(), 
    "blocked_reason" = 'DLC_EXPIRED_MIGRATION'
WHERE "expiry_date" < NOW() 
  AND "status" = 'AVAILABLE';
