-- AlterTable: clients — add credit limit and payment terms
ALTER TABLE "clients" ADD COLUMN "creditLimit" INTEGER;
ALTER TABLE "clients" ADD COLUMN "paymentTermsDays" INTEGER DEFAULT 30;

-- AlterTable: clients — make nif/rc/ai nullable (schema drift fix)
ALTER TABLE "clients" ALTER COLUMN "nif" DROP NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "nif" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "rc" DROP NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "rc" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "ai" DROP NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "ai" DROP DEFAULT;

-- AlterTable: invoices — add fiscal year, timbre rate, and cancellation fields
ALTER TABLE "invoices" ADD COLUMN "fiscalYear" INTEGER;
ALTER TABLE "invoices" ADD COLUMN "timbreRate" DECIMAL;
ALTER TABLE "invoices" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "invoices" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "invoices" ADD COLUMN "cancelledAt" TIMESTAMP(3);
