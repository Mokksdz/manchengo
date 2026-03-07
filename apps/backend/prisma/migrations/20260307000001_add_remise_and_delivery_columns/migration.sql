-- AlterTable: invoice_lines — add remise (discount) column
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "remise" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: deliveries — add delivery completion tracking
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "delivered_by_user_id" TEXT;
