#!/bin/sh
set -e

SCHEMA="./prisma/schema.prisma"

# Always attempt to baseline existing migrations (idempotent - fails silently if already done)
echo ">>> Baselining existing migrations..."
npx prisma migrate resolve --applied "20251225202314_add_delivery_module" --schema=$SCHEMA 2>&1 || true
npx prisma migrate resolve --applied "20250107_add_sync_status_enum" --schema=$SCHEMA 2>&1 || true
npx prisma migrate resolve --applied "20250108_add_purchase_orders" --schema=$SCHEMA 2>&1 || true
npx prisma migrate resolve --applied "20250128_stock_fifo_inventory_v1" --schema=$SCHEMA 2>&1 || true
npx prisma migrate resolve --applied "20260202000000_float_to_decimal" --schema=$SCHEMA 2>&1 || true
echo ">>> Baselining complete."

# Now apply any new migrations
echo ">>> Running prisma migrate deploy..."
npx prisma migrate deploy --schema=$SCHEMA 2>&1

echo ">>> Starting application..."
exec node dist/src/main
