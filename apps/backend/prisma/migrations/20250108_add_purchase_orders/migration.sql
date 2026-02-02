-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add Purchase Orders (Bons de Commande)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Date: 2025-01-08
-- Description: Adds PurchaseOrder and PurchaseOrderItem tables for the BC workflow
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create PurchaseOrderStatus enum
CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'CONFIRMED',
  'PARTIAL',
  'RECEIVED',
  'CANCELLED'
);

-- Create purchase_orders table
CREATE TABLE "purchase_orders" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "supplier_id" INTEGER NOT NULL,
  "linked_demand_id" INTEGER NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "total_ht" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'DZD',
  "expected_delivery" TIMESTAMP(3),
  "delivery_address" TEXT,
  "notes" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "sent_by_id" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "confirmed_by_id" TEXT,
  "received_at" TIMESTAMP(3),
  "received_by_id" TEXT,
  "cancelled_at" TIMESTAMP(3),
  "cancelled_by_id" TEXT,
  "cancel_reason" TEXT,
  "reception_mp_id" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- Create purchase_order_items table
CREATE TABLE "purchase_order_items" (
  "id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "product_mp_id" INTEGER NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "quantity_received" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unit_price" DOUBLE PRECISION NOT NULL,
  "total_ht" DOUBLE PRECISION NOT NULL,
  "tva_rate" INTEGER NOT NULL DEFAULT 19,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on reference
CREATE UNIQUE INDEX "purchase_orders_reference_key" ON "purchase_orders"("reference");

-- Create indexes for purchase_orders
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");
CREATE INDEX "purchase_orders_linked_demand_id_idx" ON "purchase_orders"("linked_demand_id");
CREATE INDEX "purchase_orders_created_at_idx" ON "purchase_orders"("created_at");

-- Create indexes for purchase_order_items
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");
CREATE INDEX "purchase_order_items_product_mp_id_idx" ON "purchase_order_items"("product_mp_id");

-- Add foreign keys for purchase_orders
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" 
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_linked_demand_id_fkey" 
  FOREIGN KEY ("linked_demand_id") REFERENCES "demandes_approvisionnement_mp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" 
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_sent_by_id_fkey" 
  FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_confirmed_by_id_fkey" 
  FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_received_by_id_fkey" 
  FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cancelled_by_id_fkey" 
  FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign keys for purchase_order_items
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" 
  FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_mp_id_fkey" 
  FOREIGN KEY ("product_mp_id") REFERENCES "products_mp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
