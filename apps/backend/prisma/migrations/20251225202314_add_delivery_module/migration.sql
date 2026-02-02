-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'APPRO', 'PRODUCTION', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "ProductMpCategory" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'ADDITIVE', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('DISTRIBUTEUR', 'GROSSISTE', 'SUPERETTE', 'FAST_FOOD');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('MP', 'PF');

-- CreateEnum
CREATE TYPE "MovementOrigin" AS ENUM ('RECEPTION', 'PRODUCTION_IN', 'PRODUCTION_OUT', 'VENTE', 'INVENTAIRE', 'RETOUR_CLIENT', 'PERTE');

-- CreateEnum
CREATE TYPE "ReceptionStatus" AS ENUM ('DRAFT', 'VALIDATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecipeItemType" AS ENUM ('MP', 'FLUID', 'PACKAGING');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ESPECES', 'CHEQUE', 'VIREMENT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'VALIDATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SecurityAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'DEVICE_REGISTER', 'DEVICE_REVOKE', 'USER_BLOCK', 'USER_UNBLOCK', 'ROLE_CHANGE', 'SYNC_PUSH', 'SYNC_PULL', 'ACCESS_DENIED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('DEVICE_OFFLINE', 'SYNC_FAILURE', 'PENDING_EVENTS', 'LOW_STOCK_MP', 'LOW_STOCK_PF', 'STOCK_EXPIRING', 'HIGH_CASH_SALES', 'MISSING_STAMP_DUTY', 'VAT_THRESHOLD', 'ACCESS_DENIED_SPIKE', 'FAILED_LOGIN_SPIKE', 'DEVICE_REVOKED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WINDOWS', 'MACOS', 'WEB');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'COMMERCIAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "app_version" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_states" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "last_pull_at" TIMESTAMP(3) NOT NULL,
    "last_push_at" TIMESTAMP(3),
    "server_time" TIMESTAMP(3) NOT NULL,
    "pending_events" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_events" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "device_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_mp" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" "ProductMpCategory" NOT NULL DEFAULT 'RAW_MATERIAL',
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_stock_tracked" BOOLEAN NOT NULL DEFAULT true,
    "default_tva_rate" INTEGER NOT NULL DEFAULT 19,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_mp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products_pf" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price_ht" INTEGER NOT NULL,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rc" TEXT NOT NULL DEFAULT 'MIGRATED',
    "nif" TEXT NOT NULL DEFAULT '000000000000000',
    "ai" TEXT NOT NULL DEFAULT 'MIGRATED',
    "nis" TEXT,
    "phone" TEXT NOT NULL DEFAULT '0000000000',
    "address" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'DISTRIBUTEUR',
    "nif" TEXT NOT NULL DEFAULT '',
    "rc" TEXT NOT NULL DEFAULT '',
    "ai" TEXT NOT NULL DEFAULT '',
    "nis" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots_mp" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "lot_number" TEXT NOT NULL,
    "quantity_initial" INTEGER NOT NULL DEFAULT 0,
    "quantity_remaining" INTEGER NOT NULL DEFAULT 0,
    "manufacture_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "supplier_id" INTEGER,
    "reception_id" INTEGER,
    "unit_cost" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_mp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots_pf" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "lot_number" TEXT NOT NULL,
    "quantity_initial" INTEGER NOT NULL DEFAULT 0,
    "quantity_remaining" INTEGER NOT NULL DEFAULT 0,
    "manufacture_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" TIMESTAMP(3),
    "production_order_id" INTEGER,
    "unit_cost" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "movement_type" "MovementType" NOT NULL,
    "product_type" "ProductType" NOT NULL,
    "origin" "MovementOrigin" NOT NULL,
    "product_mp_id" INTEGER,
    "product_pf_id" INTEGER,
    "lot_mp_id" INTEGER,
    "lot_pf_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "unit_cost" INTEGER,
    "reference_type" TEXT,
    "reference_id" INTEGER,
    "reference" TEXT,
    "user_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "delete_reason" TEXT,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receptions_mp" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bl_number" TEXT,
    "status" "ReceptionStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "user_id" TEXT NOT NULL,
    "validated_at" TIMESTAMP(3),
    "validated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receptions_mp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reception_mp_lines" (
    "id" SERIAL NOT NULL,
    "reception_id" INTEGER NOT NULL,
    "product_mp_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" INTEGER,
    "lot_number" TEXT,
    "expiry_date" TIMESTAMP(3),
    "tva_rate" INTEGER NOT NULL DEFAULT 19,
    "total_ht" INTEGER,
    "tva_amount" INTEGER,
    "total_ttc" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reception_mp_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "product_pf_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "batch_weight" INTEGER NOT NULL,
    "output_quantity" INTEGER NOT NULL DEFAULT 1,
    "loss_tolerance" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "production_time" INTEGER,
    "shelf_life_days" INTEGER NOT NULL DEFAULT 90,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "type" "RecipeItemType" NOT NULL DEFAULT 'MP',
    "product_mp_id" INTEGER,
    "name" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_cost" DOUBLE PRECISION,
    "affects_stock" BOOLEAN NOT NULL DEFAULT true,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "is_substitutable" BOOLEAN NOT NULL DEFAULT false,
    "substitute_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "product_pf_id" INTEGER NOT NULL,
    "recipe_id" INTEGER,
    "batch_count" INTEGER NOT NULL DEFAULT 1,
    "target_quantity" INTEGER NOT NULL,
    "quantity_produced" INTEGER NOT NULL DEFAULT 0,
    "batch_weight_real" INTEGER,
    "yield_percentage" DOUBLE PRECISION,
    "status" "ProductionStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "quality_notes" TEXT,
    "quality_status" TEXT,
    "user_id" TEXT NOT NULL,
    "started_by" TEXT,
    "completed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_consumptions" (
    "id" SERIAL NOT NULL,
    "production_order_id" INTEGER NOT NULL,
    "product_mp_id" INTEGER NOT NULL,
    "lot_mp_id" INTEGER,
    "quantity_planned" DOUBLE PRECISION NOT NULL,
    "quantity_consumed" DOUBLE PRECISION NOT NULL,
    "unit_cost" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "total_ht" INTEGER NOT NULL,
    "total_tva" INTEGER NOT NULL,
    "total_ttc" INTEGER NOT NULL,
    "timbre_fiscal" INTEGER NOT NULL DEFAULT 0,
    "net_to_pay" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "product_pf_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_ht" INTEGER NOT NULL,
    "line_ht" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "client_id" INTEGER NOT NULL,
    "qr_code" TEXT NOT NULL,
    "qr_checksum" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "validated_at" TIMESTAMP(3),
    "validated_by_user_id" TEXT,
    "validated_by_device_id" TEXT,
    "scheduled_date" TIMESTAMP(3),
    "delivery_address" TEXT,
    "delivery_notes" TEXT,
    "proof_photo" TEXT,
    "recipient_name" TEXT,
    "recipient_signature" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_user_id" TEXT,
    "cancel_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_validation_logs" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "qr_scanned" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_code" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_validation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_logs" (
    "id" TEXT NOT NULL,
    "action" "SecurityAction" NOT NULL,
    "user_id" TEXT,
    "target_id" TEXT,
    "device_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB,
    "threshold" DOUBLE PRECISION,
    "value" DOUBLE PRECISION,
    "acked_by" TEXT,
    "acked_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_history" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "LicenseType" NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_devices" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "license_key" TEXT NOT NULL,
    "features" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_devices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "device_name" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "company_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_users" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_code_key" ON "users"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "sync_states_device_id_key" ON "sync_states"("device_id");

-- CreateIndex
CREATE INDEX "sync_events_device_id_occurred_at_idx" ON "sync_events"("device_id", "occurred_at");

-- CreateIndex
CREATE INDEX "sync_events_entity_type_entity_id_idx" ON "sync_events"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "sync_events_applied_at_idx" ON "sync_events"("applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "products_mp_code_key" ON "products_mp"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_pf_code_key" ON "products_pf"("code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "clients_code_key" ON "clients"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lots_mp_lot_number_key" ON "lots_mp"("lot_number");

-- CreateIndex
CREATE INDEX "lots_mp_product_id_expiry_date_idx" ON "lots_mp"("product_id", "expiry_date");

-- CreateIndex
CREATE INDEX "lots_mp_product_id_is_active_idx" ON "lots_mp"("product_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "lots_pf_lot_number_key" ON "lots_pf"("lot_number");

-- CreateIndex
CREATE INDEX "lots_pf_product_id_expiry_date_idx" ON "lots_pf"("product_id", "expiry_date");

-- CreateIndex
CREATE INDEX "lots_pf_product_id_is_active_idx" ON "lots_pf"("product_id", "is_active");

-- CreateIndex
CREATE INDEX "stock_movements_product_type_created_at_idx" ON "stock_movements"("product_type", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_origin_idx" ON "stock_movements"("origin");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_mp_id_is_deleted_idx" ON "stock_movements"("product_mp_id", "is_deleted");

-- CreateIndex
CREATE INDEX "stock_movements_product_pf_id_is_deleted_idx" ON "stock_movements"("product_pf_id", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "receptions_mp_reference_key" ON "receptions_mp"("reference");

-- CreateIndex
CREATE INDEX "receptions_mp_supplier_id_date_idx" ON "receptions_mp"("supplier_id", "date");

-- CreateIndex
CREATE INDEX "receptions_mp_status_idx" ON "receptions_mp"("status");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_product_pf_id_key" ON "recipes"("product_pf_id");

-- CreateIndex
CREATE INDEX "recipe_items_recipe_id_idx" ON "recipe_items"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_items_product_mp_id_idx" ON "recipe_items"("product_mp_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_reference_key" ON "production_orders"("reference");

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_product_pf_id_idx" ON "production_orders"("product_pf_id");

-- CreateIndex
CREATE INDEX "production_orders_recipe_id_idx" ON "production_orders"("recipe_id");

-- CreateIndex
CREATE INDEX "production_consumptions_production_order_id_idx" ON "production_consumptions"("production_order_id");

-- CreateIndex
CREATE INDEX "production_consumptions_lot_mp_id_idx" ON "production_consumptions"("lot_mp_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_reference_key" ON "invoices"("reference");

-- CreateIndex
CREATE INDEX "invoices_client_id_date_idx" ON "invoices"("client_id", "date");

-- CreateIndex
CREATE INDEX "invoices_date_idx" ON "invoices"("date");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_reference_key" ON "deliveries"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_qr_code_key" ON "deliveries"("qr_code");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "deliveries_invoice_id_idx" ON "deliveries"("invoice_id");

-- CreateIndex
CREATE INDEX "deliveries_client_id_status_idx" ON "deliveries"("client_id", "status");

-- CreateIndex
CREATE INDEX "deliveries_scheduled_date_status_idx" ON "deliveries"("scheduled_date", "status");

-- CreateIndex
CREATE INDEX "deliveries_qr_checksum_idx" ON "deliveries"("qr_checksum");

-- CreateIndex
CREATE INDEX "delivery_validation_logs_delivery_id_created_at_idx" ON "delivery_validation_logs"("delivery_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_validation_logs_user_id_created_at_idx" ON "delivery_validation_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_validation_logs_action_created_at_idx" ON "delivery_validation_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "security_logs_action_created_at_idx" ON "security_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "security_logs_user_id_created_at_idx" ON "security_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "security_logs_device_id_created_at_idx" ON "security_logs"("device_id", "created_at");

-- CreateIndex
CREATE INDEX "alerts_type_status_idx" ON "alerts"("type", "status");

-- CreateIndex
CREATE INDEX "alerts_status_created_at_idx" ON "alerts"("status", "created_at");

-- CreateIndex
CREATE INDEX "alerts_entity_type_entity_id_idx" ON "alerts"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "alert_history_alert_id_created_at_idx" ON "alert_history"("alert_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_license_key_key" ON "licenses"("license_key");

-- CreateIndex
CREATE INDEX "licenses_company_id_status_idx" ON "licenses"("company_id", "status");

-- CreateIndex
CREATE INDEX "licenses_license_key_idx" ON "licenses"("license_key");

-- CreateIndex
CREATE INDEX "company_devices_company_id_is_active_idx" ON "company_devices"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "company_devices_company_id_device_id_key" ON "company_devices"("company_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_users_company_id_user_id_key" ON "company_users"("company_id", "user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_states" ADD CONSTRAINT "sync_states_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots_mp" ADD CONSTRAINT "lots_mp_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products_mp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots_mp" ADD CONSTRAINT "lots_mp_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots_pf" ADD CONSTRAINT "lots_pf_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products_pf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots_pf" ADD CONSTRAINT "lots_pf_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_mp_id_fkey" FOREIGN KEY ("product_mp_id") REFERENCES "products_mp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_pf_id_fkey" FOREIGN KEY ("product_pf_id") REFERENCES "products_pf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_mp_id_fkey" FOREIGN KEY ("lot_mp_id") REFERENCES "lots_mp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_pf_id_fkey" FOREIGN KEY ("lot_pf_id") REFERENCES "lots_pf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receptions_mp" ADD CONSTRAINT "receptions_mp_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_mp_lines" ADD CONSTRAINT "reception_mp_lines_reception_id_fkey" FOREIGN KEY ("reception_id") REFERENCES "receptions_mp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reception_mp_lines" ADD CONSTRAINT "reception_mp_lines_product_mp_id_fkey" FOREIGN KEY ("product_mp_id") REFERENCES "products_mp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_product_pf_id_fkey" FOREIGN KEY ("product_pf_id") REFERENCES "products_pf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_product_mp_id_fkey" FOREIGN KEY ("product_mp_id") REFERENCES "products_mp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_pf_id_fkey" FOREIGN KEY ("product_pf_id") REFERENCES "products_pf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_consumptions" ADD CONSTRAINT "production_consumptions_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_consumptions" ADD CONSTRAINT "production_consumptions_product_mp_id_fkey" FOREIGN KEY ("product_mp_id") REFERENCES "products_mp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_consumptions" ADD CONSTRAINT "production_consumptions_lot_mp_id_fkey" FOREIGN KEY ("lot_mp_id") REFERENCES "lots_mp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_product_pf_id_fkey" FOREIGN KEY ("product_pf_id") REFERENCES "products_pf"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_devices" ADD CONSTRAINT "company_devices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
