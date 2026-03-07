#!/bin/sh
set -e

SCHEMA="./prisma/schema.prisma"

# Check if _prisma_migrations table exists
TABLE_EXISTS=$(npx prisma db execute --schema=$SCHEMA --stdin <<'SQL' 2>/dev/null || echo "NO")
SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '_prisma_migrations');
SQL

# If migrations table doesn't exist, baseline all existing migrations
if echo "$TABLE_EXISTS" | grep -q "f" || echo "$TABLE_EXISTS" | grep -q "NO"; then
  echo ">>> Baselining existing migrations..."
  npx prisma migrate resolve --applied "20251225202314_add_delivery_module" --schema=$SCHEMA 2>&1 || true
  npx prisma migrate resolve --applied "20250107_add_sync_status_enum" --schema=$SCHEMA 2>&1 || true
  npx prisma migrate resolve --applied "20250108_add_purchase_orders" --schema=$SCHEMA 2>&1 || true
  npx prisma migrate resolve --applied "20250128_stock_fifo_inventory_v1" --schema=$SCHEMA 2>&1 || true
  npx prisma migrate resolve --applied "20260202000000_float_to_decimal" --schema=$SCHEMA 2>&1 || true
  echo ">>> Baselining complete."
fi

# Now apply any new migrations
echo ">>> Running prisma migrate deploy..."
npx prisma migrate deploy --schema=$SCHEMA 2>&1

echo ">>> Starting application..."
exec node dist/src/main
