-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'APPLIED', 'ACKED', 'FAILED');

-- AlterTable: Add new columns to sync_events
ALTER TABLE "sync_events" ADD COLUMN IF NOT EXISTS "client_event_id" TEXT;
ALTER TABLE "sync_events" ADD COLUMN IF NOT EXISTS "payload_hash" TEXT;
ALTER TABLE "sync_events" ADD COLUMN IF NOT EXISTS "status" "SyncStatus" DEFAULT 'PENDING';
ALTER TABLE "sync_events" ADD COLUMN IF NOT EXISTS "error_code" TEXT;
ALTER TABLE "sync_events" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "sync_events" ADD COLUMN IF NOT EXISTS "resolution" JSONB;
ALTER TABLE "sync_events" ADD COLUMN IF NOT EXISTS "batch_id" TEXT;
ALTER TABLE "sync_events" ADD COLUMN IF NOT EXISTS "server_event_id" TEXT;

-- Migrate existing data: Use id as client_event_id for existing records
UPDATE "sync_events" SET "client_event_id" = "id" WHERE "client_event_id" IS NULL;

-- Make client_event_id required and unique
ALTER TABLE "sync_events" ALTER COLUMN "client_event_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sync_events_client_event_id_key" ON "sync_events"("client_event_id");
CREATE INDEX IF NOT EXISTS "sync_events_status_idx" ON "sync_events"("status");
CREATE INDEX IF NOT EXISTS "sync_events_batch_id_idx" ON "sync_events"("batch_id");

-- Update index on deviceId and createdAt
DROP INDEX IF EXISTS "sync_events_device_id_occurred_at_idx";
CREATE INDEX IF NOT EXISTS "sync_events_device_id_created_at_idx" ON "sync_events"("device_id", "created_at");
