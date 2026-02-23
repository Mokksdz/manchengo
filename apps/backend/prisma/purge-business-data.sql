-- ═══════════════════════════════════════════════════════════════════════════════
-- PURGE MANCHENGO ERP — Supprime toutes les données business
-- ═══════════════════════════════════════════════════════════════════════════════
-- Conserve : users, companies, licenses, devices, audit_logs
-- Ordre : respecte les contraintes de clés étrangères
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Leaf tables (dépendances les plus profondes)
TRUNCATE delivery_validation_logs CASCADE;
TRUNCATE alert_history CASCADE;
TRUNCATE appro_alerts CASCADE;
TRUNCATE alerts CASCADE;
TRUNCATE domain_events CASCADE;
TRUNCATE security_logs CASCADE;
TRUNCATE idempotency_keys CASCADE;

-- 2. Stock & mouvements
TRUNCATE stock_movements CASCADE;
TRUNCATE inventory_declarations CASCADE;

-- 3. Production
TRUNCATE production_consumptions CASCADE;
TRUNCATE production_orders CASCADE;
TRUNCATE recipe_items CASCADE;
TRUNCATE recipes CASCADE;

-- 4. Commerce
TRUNCATE deliveries CASCADE;
TRUNCATE invoice_lines CASCADE;
TRUNCATE payments CASCADE;
TRUNCATE invoices CASCADE;

-- 5. Approvisionnement
TRUNCATE purchase_order_items CASCADE;
TRUNCATE purchase_orders CASCADE;
TRUNCATE reception_mp_lines CASCADE;
TRUNCATE receptions_mp CASCADE;

-- 6. Lots
TRUNCATE lots_pf CASCADE;
TRUNCATE lots_mp CASCADE;

-- 7. Produits
TRUNCATE products_pf CASCADE;
TRUNCATE products_mp CASCADE;
TRUNCATE product_families CASCADE;
TRUNCATE brands CASCADE;

-- 8. Entités business
TRUNCATE suppliers CASCADE;
TRUNCATE clients CASCADE;

COMMIT;
