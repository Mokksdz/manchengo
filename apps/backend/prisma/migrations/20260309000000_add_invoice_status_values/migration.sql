-- Add missing InvoiceStatus enum values (VALIDATED, PARTIALLY_PAID)
-- The initial migration only created DRAFT, PAID, CANCELLED
-- The Prisma schema expects DRAFT, VALIDATED, PARTIALLY_PAID, PAID, CANCELLED

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'VALIDATED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

-- Also add DELIVERED to DeliveryStatus if missing
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
