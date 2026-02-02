# Manchengo Smart ERP — Business Logic Specification (P1)

**Version**: 1.0  
**Status**: FINAL  
**Date**: 2025-01-20  

---

## Overview

This document defines the business logic for Manchengo Smart ERP Phase 1.  
All functions are **service-layer operations** executed in application code.  
SQLite is accessed only via standard INSERT/UPDATE/SELECT — no triggers, no stored procedures.

---

## Table of Contents

1. [Authorization Rules](#1-authorization-rules)
2. [Approvisionnement (MP Reception)](#2-approvisionnement-mp-reception)
3. [Stock FIFO — MP Consumption](#3-stock-fifo--mp-consumption)
4. [Production](#4-production)
5. [Stock FIFO — PF Sales](#5-stock-fifo--pf-sales)
6. [Sales & Invoicing](#6-sales--invoicing)
7. [Algerian Fiscal Rules](#7-algerian-fiscal-rules)
8. [Offline Sync Events](#8-offline-sync-events)

---

## 1. Authorization Rules

### 1.1 Roles Definition

```
ROLES:
  ADMIN       = Full access to all modules
  APPRO       = Approvisionnement + Stock MP (read/write)
  PRODUCTION  = Production + Stock MP (read) + Stock PF (write)
  COMMERCIAL  = Sales + Stock PF (read) + Clients + Invoices
  COMPTABLE   = Read-only on all + Payments + Reports
```

### 1.2 Permission Matrix

```
MODULE              | ADMIN | APPRO | PRODUCTION | COMMERCIAL | COMPTABLE
--------------------|-------|-------|------------|------------|----------
users.write         |   ✓   |       |            |            |
products_mp.write   |   ✓   |   ✓   |            |            |
products_pf.write   |   ✓   |       |     ✓      |            |
suppliers.write     |   ✓   |   ✓   |            |            |
lots_mp.write       |   ✓   |   ✓   |     ✓      |            |
lots_pf.write       |   ✓   |       |     ✓      |            |
reception.write     |   ✓   |   ✓   |            |            |
production.write    |   ✓   |       |     ✓      |            |
clients.write       |   ✓   |       |            |     ✓      |
sales_orders.write  |   ✓   |       |            |     ✓      |
invoices.write      |   ✓   |       |            |     ✓      |
payments.write      |   ✓   |       |            |     ✓      |     ✓
*.read              |   ✓   |   ✓   |     ✓      |     ✓      |     ✓
```

### 1.3 authorize()

```
FUNCTION authorize(user_id, action, resource)

INPUTS:
  user_id   : UUID
  action    : "read" | "write"
  resource  : string (table or module name)

PRECONDITIONS:
  - user_id exists in users table
  - user.is_active = true

LOGIC:
  1. SELECT role FROM users WHERE id = user_id
  2. IF user not found OR user.is_active = false:
       THROW AuthorizationError("User inactive or not found")
  3. LOOKUP permission in PERMISSION_MATRIX[role][resource][action]
  4. IF permission = false:
       THROW AuthorizationError("Access denied: {role} cannot {action} on {resource}")
  5. RETURN true

ERRORS:
  - AuthorizationError: User not found, inactive, or insufficient permissions
```

---

## 2. Approvisionnement (MP Reception)

### 2.1 create_supplier()

```
FUNCTION create_supplier(user_id, data)

INPUTS:
  user_id  : UUID
  data     : {
    code        : string (unique, uppercase)
    name        : string
    phone       : string (optional)
    address     : string (optional)
    nif         : string (optional, 15 digits)
    nis         : string (optional, 11 digits)
    rc          : string (optional)
  }

PRECONDITIONS:
  - authorize(user_id, "write", "suppliers")
  - data.code is unique
  - IF data.nif provided: validate_nif(data.nif) = true
  - IF data.nis provided: validate_nis(data.nis) = true

LOGIC:
  1. GENERATE id = new UUID
  2. GENERATE created_at = NOW()
  3. INSERT INTO suppliers (id, code, name, phone, address, nif, nis, rc, 
                            is_active, created_at, created_by)
     VALUES (id, UPPER(data.code), data.name, data.phone, data.address,
             data.nif, data.nis, data.rc, true, created_at, user_id)
  4. CALL emit_event("supplier", id, "created", {code, name})
  5. RETURN id

TABLES AFFECTED:
  - suppliers (INSERT)
  - _events (INSERT)

ERRORS:
  - ValidationError: Duplicate code
  - ValidationError: Invalid NIF/NIS format
  - AuthorizationError: Insufficient permissions
```

### 2.2 create_reception_note()

```
FUNCTION create_reception_note(user_id, data)

INPUTS:
  user_id  : UUID
  data     : {
    supplier_id    : UUID
    supplier_bl    : string (supplier's delivery note number)
    reception_date : date
    notes          : string (optional)
  }

PRECONDITIONS:
  - authorize(user_id, "write", "reception")
  - supplier_id exists and is_active

LOGIC:
  1. GENERATE id = new UUID
  2. GENERATE reference = "REC-" + FORMAT(reception_date, "YYMMDD") + "-" + SEQUENCE(5)
  3. INSERT INTO reception_notes (id, reference, supplier_id, supplier_bl, 
                                   reception_date, status, notes, 
                                   created_at, created_by)
     VALUES (id, reference, supplier_id, supplier_bl, reception_date, 
             "DRAFT", notes, NOW(), user_id)
  4. CALL emit_event("reception_note", id, "created", {reference, supplier_id})
  5. RETURN {id, reference}

TABLES AFFECTED:
  - reception_notes (INSERT)
  - _events (INSERT)

ERRORS:
  - NotFoundError: Supplier not found
  - ValidationError: Supplier inactive
```

### 2.3 add_reception_line()

```
FUNCTION add_reception_line(user_id, reception_id, data)

INPUTS:
  user_id      : UUID
  reception_id : UUID
  data         : {
    product_mp_id  : UUID
    quantity       : decimal > 0
    unit           : string
    unit_price     : integer (centimes) >= 0
    expiry_date    : date (optional)
  }

PRECONDITIONS:
  - authorize(user_id, "write", "reception")
  - reception_note exists with status = "DRAFT"
  - product_mp_id exists and is_active

LOGIC:
  1. SELECT status FROM reception_notes WHERE id = reception_id
  2. IF status != "DRAFT":
       THROW ValidationError("Cannot modify validated reception")
  3. GENERATE line_id = new UUID
  4. CALCULATE line_total = data.quantity * data.unit_price
  5. INSERT INTO reception_lines (id, reception_id, product_mp_id, 
                                   quantity, unit, unit_price, line_total,
                                   expiry_date)
     VALUES (line_id, reception_id, product_mp_id, quantity, unit, 
             unit_price, line_total, expiry_date)
  6. RETURN line_id

TABLES AFFECTED:
  - reception_lines (INSERT)

ERRORS:
  - NotFoundError: Reception or product not found
  - ValidationError: Reception not in DRAFT status
  - ValidationError: Quantity must be positive
```

### 2.4 validate_reception()

```
FUNCTION validate_reception(user_id, reception_id)

INPUTS:
  user_id      : UUID
  reception_id : UUID

PRECONDITIONS:
  - authorize(user_id, "write", "reception")
  - reception_note exists with status = "DRAFT"
  - reception has at least 1 line

LOGIC:
  1. SELECT * FROM reception_notes WHERE id = reception_id
  2. IF reception.status != "DRAFT":
       THROW ValidationError("Reception already validated or cancelled")
  3. SELECT COUNT(*) AS line_count FROM reception_lines WHERE reception_id = reception_id
  4. IF line_count = 0:
       THROW ValidationError("Reception must have at least one line")
  
  5. FOR EACH line IN (SELECT * FROM reception_lines WHERE reception_id = reception_id):
       5a. GENERATE lot_id = new UUID
       5b. GENERATE lot_number = "LOT-" + FORMAT(NOW(), "YYMMDD") + "-" + SEQUENCE(5)
       5c. GENERATE qr_code = "MCG:LMP:" + SHORT_ID(lot_id)
       5d. INSERT INTO lots_mp (id, lot_number, product_mp_id, reception_id,
                                 quantity_initial, quantity_remaining, unit,
                                 unit_cost, expiry_date, status, qr_code,
                                 created_at, created_by)
           VALUES (lot_id, lot_number, line.product_mp_id, reception_id,
                   line.quantity, line.quantity, line.unit,
                   line.unit_price, line.expiry_date, "AVAILABLE", qr_code,
                   NOW(), user_id)
       5e. CALL record_stock_movement(user_id, {
             lot_id: lot_id,
             product_type: "MP",
             movement_type: "ENTRY",
             quantity: line.quantity,
             reference_type: "RECEPTION",
             reference_id: reception_id
           })
       5f. CALL emit_event("lot_mp", lot_id, "created", {lot_number, quantity: line.quantity})
  
  6. CALCULATE total = SUM(line_total) FROM reception_lines WHERE reception_id = reception_id
  7. UPDATE reception_notes 
     SET status = "VALIDATED", total_amount = total, validated_at = NOW(), validated_by = user_id
     WHERE id = reception_id
  8. CALL emit_event("reception_note", reception_id, "validated", {total_amount: total})
  9. RETURN {lots_created: line_count}

TABLES AFFECTED:
  - reception_notes (UPDATE)
  - lots_mp (INSERT, multiple)
  - stock_movements (INSERT, multiple)
  - _events (INSERT, multiple)

ERRORS:
  - ValidationError: Reception not in DRAFT
  - ValidationError: No lines
```

---

## 3. Stock FIFO — MP Consumption

### 3.1 get_available_lots_mp()

```
FUNCTION get_available_lots_mp(product_mp_id)

INPUTS:
  product_mp_id : UUID

LOGIC:
  1. SELECT * FROM lots_mp 
     WHERE product_mp_id = product_mp_id
       AND status = "AVAILABLE"
       AND quantity_remaining > 0
       AND (expiry_date IS NULL OR expiry_date > TODAY())
     ORDER BY created_at ASC  -- FIFO: oldest first
  2. RETURN list of lots

TABLES AFFECTED:
  - None (read only)
```

### 3.2 check_mp_availability()

```
FUNCTION check_mp_availability(product_mp_id, required_quantity)

INPUTS:
  product_mp_id     : UUID
  required_quantity : decimal > 0

LOGIC:
  1. lots = CALL get_available_lots_mp(product_mp_id)
  2. total_available = SUM(lot.quantity_remaining) FOR lot IN lots
  3. RETURN {
       available: total_available >= required_quantity,
       total_available: total_available,
       shortage: MAX(0, required_quantity - total_available),
       lots: lots
     }

TABLES AFFECTED:
  - None (read only)
```

### 3.3 consume_mp_fifo()

```
FUNCTION consume_mp_fifo(user_id, data)

INPUTS:
  user_id : UUID
  data    : {
    product_mp_id    : UUID
    quantity         : decimal > 0
    reference_type   : "PRODUCTION" | "ADJUSTMENT" | "LOSS"
    reference_id     : UUID
  }

PRECONDITIONS:
  - authorize(user_id, "write", "lots_mp")
  - Sufficient stock available for product

LOGIC:
  1. availability = CALL check_mp_availability(product_mp_id, data.quantity)
  2. IF NOT availability.available:
       THROW InsufficientStockError("Insufficient MP stock", {
         product_id: product_mp_id,
         required: data.quantity,
         available: availability.total_available
       })
  
  3. remaining_to_consume = data.quantity
  4. consumptions = []
  
  5. FOR EACH lot IN availability.lots WHILE remaining_to_consume > 0:
       5a. consume_from_lot = MIN(lot.quantity_remaining, remaining_to_consume)
       5b. new_quantity = lot.quantity_remaining - consume_from_lot
       5c. new_status = IF new_quantity = 0 THEN "CONSUMED" ELSE "AVAILABLE"
       
       5d. UPDATE lots_mp 
           SET quantity_remaining = new_quantity, 
               status = new_status,
               updated_at = NOW(),
               updated_by = user_id
           WHERE id = lot.id
       
       5e. CALL record_stock_movement(user_id, {
             lot_id: lot.id,
             product_type: "MP",
             movement_type: "EXIT",
             quantity: consume_from_lot,
             reference_type: data.reference_type,
             reference_id: data.reference_id
           })
       
       5f. consumptions.APPEND({
             lot_id: lot.id,
             lot_number: lot.lot_number,
             quantity: consume_from_lot,
             unit_cost: lot.unit_cost
           })
       
       5g. CALL emit_event("lot_mp", lot.id, "consumed", {
             quantity: consume_from_lot,
             reference_type: data.reference_type,
             reference_id: data.reference_id
           })
       
       5h. remaining_to_consume = remaining_to_consume - consume_from_lot
  
  6. RETURN {
       total_consumed: data.quantity,
       consumptions: consumptions,
       total_cost: SUM(c.quantity * c.unit_cost) FOR c IN consumptions
     }

TABLES AFFECTED:
  - lots_mp (UPDATE, multiple)
  - stock_movements (INSERT, multiple)
  - _events (INSERT, multiple)

ERRORS:
  - InsufficientStockError: Not enough stock
  - AuthorizationError: Insufficient permissions
```

### 3.4 record_stock_movement()

```
FUNCTION record_stock_movement(user_id, data)

INPUTS:
  user_id : UUID
  data    : {
    lot_id         : UUID
    product_type   : "MP" | "PF"
    movement_type  : "ENTRY" | "EXIT" | "ADJUSTMENT"
    quantity       : decimal (positive for entry, negative for exit)
    reference_type : string
    reference_id   : UUID
  }

LOGIC:
  1. GENERATE id = new UUID
  2. signed_quantity = IF data.movement_type = "EXIT" 
                       THEN -ABS(data.quantity) 
                       ELSE ABS(data.quantity)
  3. INSERT INTO stock_movements (id, lot_id, product_type, movement_type,
                                   quantity, reference_type, reference_id,
                                   created_at, created_by)
     VALUES (id, lot_id, product_type, movement_type,
             signed_quantity, reference_type, reference_id,
             NOW(), user_id)
  4. RETURN id

TABLES AFFECTED:
  - stock_movements (INSERT)
```

---

## 4. Production

### 4.1 create_production_order()

```
FUNCTION create_production_order(user_id, data)

INPUTS:
  user_id : UUID
  data    : {
    product_pf_id    : UUID
    planned_quantity : decimal > 0
    planned_date     : date
    notes            : string (optional)
  }

PRECONDITIONS:
  - authorize(user_id, "write", "production")
  - product_pf_id exists and is_active

LOGIC:
  1. GENERATE id = new UUID
  2. GENERATE order_number = "OF-" + FORMAT(planned_date, "YYMMDD") + "-" + SEQUENCE(5)
  3. GENERATE qr_code = "MCG:ORD:" + SHORT_ID(id)
  4. INSERT INTO production_orders (id, order_number, product_pf_id,
                                     planned_quantity, planned_date, 
                                     status, qr_code, notes,
                                     created_at, created_by)
     VALUES (id, order_number, product_pf_id, planned_quantity,
             planned_date, "DRAFT", qr_code, notes, NOW(), user_id)
  5. CALL emit_event("production_order", id, "created", {order_number, product_pf_id})
  6. RETURN {id, order_number, qr_code}

TABLES AFFECTED:
  - production_orders (INSERT)
  - _events (INSERT)

ERRORS:
  - NotFoundError: Product PF not found
  - ValidationError: Planned quantity must be positive
```

### 4.2 start_production()

```
FUNCTION start_production(user_id, order_id)

INPUTS:
  user_id  : UUID
  order_id : UUID

PRECONDITIONS:
  - authorize(user_id, "write", "production")
  - production_order exists with status = "DRAFT" or "CONFIRMED"

LOGIC:
  1. SELECT * FROM production_orders WHERE id = order_id
  2. IF order.status NOT IN ("DRAFT", "CONFIRMED"):
       THROW ValidationError("Production can only start from DRAFT or CONFIRMED status")
  3. UPDATE production_orders 
     SET status = "IN_PROGRESS", started_at = NOW(), started_by = user_id
     WHERE id = order_id
  4. CALL emit_event("production_order", order_id, "started", {})
  5. RETURN {status: "IN_PROGRESS"}

TABLES AFFECTED:
  - production_orders (UPDATE)
  - _events (INSERT)

ERRORS:
  - NotFoundError: Order not found
  - ValidationError: Invalid status transition
```

### 4.3 record_mp_consumption()

```
FUNCTION record_mp_consumption(user_id, order_id, lot_qr_code, quantity)

INPUTS:
  user_id     : UUID
  order_id    : UUID
  lot_qr_code : string (scanned QR code)
  quantity    : decimal > 0

PRECONDITIONS:
  - authorize(user_id, "write", "production")
  - production_order exists with status = "IN_PROGRESS"
  - lot_mp identified by QR is AVAILABLE with sufficient quantity

LOGIC:
  1. SELECT * FROM production_orders WHERE id = order_id
  2. IF order.status != "IN_PROGRESS":
       THROW ValidationError("Consumption only allowed for IN_PROGRESS orders")
  
  3. lot_id = CALL parse_qr_code(lot_qr_code)
  4. IF lot_id.type != "LMP":
       THROW ValidationError("QR code is not a raw material lot")
  
  5. SELECT * FROM lots_mp WHERE id = lot_id.id
  6. IF lot IS NULL:
       THROW NotFoundError("Lot not found")
  7. IF lot.status != "AVAILABLE":
       THROW ValidationError("Lot is not available for consumption")
  8. IF lot.quantity_remaining < quantity:
       THROW InsufficientStockError("Lot has insufficient quantity", {
         available: lot.quantity_remaining,
         requested: quantity
       })
  
  9. -- Consume from this specific lot (not FIFO across all lots)
  10. new_quantity = lot.quantity_remaining - quantity
  11. new_status = IF new_quantity = 0 THEN "CONSUMED" ELSE "AVAILABLE"
  
  12. UPDATE lots_mp 
      SET quantity_remaining = new_quantity, status = new_status,
          updated_at = NOW(), updated_by = user_id
      WHERE id = lot.id
  
  13. GENERATE consumption_id = new UUID
  14. INSERT INTO production_consumptions (id, production_order_id, lot_mp_id,
                                           product_mp_id, quantity, unit_cost,
                                           scanned_at, scanned_by)
      VALUES (consumption_id, order_id, lot.id, lot.product_mp_id,
              quantity, lot.unit_cost, NOW(), user_id)
  
  15. CALL record_stock_movement(user_id, {
        lot_id: lot.id,
        product_type: "MP",
        movement_type: "EXIT",
        quantity: quantity,
        reference_type: "PRODUCTION",
        reference_id: order_id
      })
  
  16. CALL emit_event("lot_mp", lot.id, "consumed", {
        quantity: quantity,
        production_order_id: order_id
      })
  
  17. RETURN {
        consumption_id: consumption_id,
        lot_number: lot.lot_number,
        product_mp_id: lot.product_mp_id,
        quantity: quantity,
        cost: quantity * lot.unit_cost
      }

TABLES AFFECTED:
  - lots_mp (UPDATE)
  - production_consumptions (INSERT)
  - stock_movements (INSERT)
  - _events (INSERT)

ERRORS:
  - NotFoundError: Order or lot not found
  - ValidationError: Invalid QR, wrong status, wrong lot type
  - InsufficientStockError: Lot quantity insufficient
```

### 4.4 complete_production()

```
FUNCTION complete_production(user_id, order_id, actual_quantity)

INPUTS:
  user_id         : UUID
  order_id        : UUID
  actual_quantity : decimal > 0

PRECONDITIONS:
  - authorize(user_id, "write", "production")
  - production_order exists with status = "IN_PROGRESS"
  - At least one MP consumption recorded

LOGIC:
  1. SELECT * FROM production_orders WHERE id = order_id
  2. IF order.status != "IN_PROGRESS":
       THROW ValidationError("Can only complete IN_PROGRESS orders")
  
  3. SELECT COUNT(*) AS consumption_count, 
          SUM(quantity * unit_cost) AS total_mp_cost
     FROM production_consumptions 
     WHERE production_order_id = order_id
  
  4. IF consumption_count = 0:
       THROW ValidationError("Cannot complete production without MP consumption")
  
  5. -- Calculate unit cost
  6. unit_cost = CEIL(total_mp_cost / actual_quantity)  -- Round up in centimes
  
  7. -- Create PF lot
  8. GENERATE lot_id = new UUID
  9. GENERATE lot_number = "PF-" + order.order_number + "-01"
  10. GENERATE qr_code = "MCG:LPF:" + SHORT_ID(lot_id)
  
  11. INSERT INTO lots_pf (id, lot_number, product_pf_id, production_order_id,
                          quantity_initial, quantity_remaining, unit,
                          unit_cost, status, qr_code,
                          created_at, created_by)
      VALUES (lot_id, lot_number, order.product_pf_id, order_id,
              actual_quantity, actual_quantity, "UNIT",
              unit_cost, "AVAILABLE", qr_code, NOW(), user_id)
  
  12. CALL record_stock_movement(user_id, {
        lot_id: lot_id,
        product_type: "PF",
        movement_type: "ENTRY",
        quantity: actual_quantity,
        reference_type: "PRODUCTION",
        reference_id: order_id
      })
  
  13. UPDATE production_orders 
      SET status = "COMPLETED", 
          actual_quantity = actual_quantity,
          total_mp_cost = total_mp_cost,
          completed_at = NOW(),
          completed_by = user_id
      WHERE id = order_id
  
  14. CALL emit_event("production_order", order_id, "completed", {
        actual_quantity: actual_quantity,
        lot_pf_id: lot_id
      })
  
  15. CALL emit_event("lot_pf", lot_id, "created", {
        lot_number: lot_number,
        quantity: actual_quantity
      })
  
  16. RETURN {
        lot_pf_id: lot_id,
        lot_number: lot_number,
        qr_code: qr_code,
        unit_cost: unit_cost,
        total_mp_cost: total_mp_cost
      }

TABLES AFFECTED:
  - production_orders (UPDATE)
  - lots_pf (INSERT)
  - stock_movements (INSERT)
  - _events (INSERT, multiple)

ERRORS:
  - NotFoundError: Order not found
  - ValidationError: Wrong status, no consumptions
```

---

## 5. Stock FIFO — PF Sales

### 5.1 get_available_lots_pf()

```
FUNCTION get_available_lots_pf(product_pf_id)

INPUTS:
  product_pf_id : UUID

LOGIC:
  1. SELECT * FROM lots_pf 
     WHERE product_pf_id = product_pf_id
       AND status = "AVAILABLE"
       AND quantity_remaining > 0
     ORDER BY created_at ASC  -- FIFO: oldest first
  2. RETURN list of lots

TABLES AFFECTED:
  - None (read only)
```

### 5.2 check_pf_availability()

```
FUNCTION check_pf_availability(product_pf_id, required_quantity)

INPUTS:
  product_pf_id     : UUID
  required_quantity : decimal > 0

LOGIC:
  1. lots = CALL get_available_lots_pf(product_pf_id)
  2. total_available = SUM(lot.quantity_remaining) FOR lot IN lots
  3. RETURN {
       available: total_available >= required_quantity,
       total_available: total_available,
       shortage: MAX(0, required_quantity - total_available)
     }

TABLES AFFECTED:
  - None (read only)
```

### 5.3 reserve_pf_fifo()

```
FUNCTION reserve_pf_fifo(user_id, data)

INPUTS:
  user_id : UUID
  data    : {
    product_pf_id    : UUID
    quantity         : decimal > 0
    sales_order_id   : UUID
  }

PRECONDITIONS:
  - authorize(user_id, "write", "lots_pf")
  - Sufficient stock available

LOGIC:
  1. availability = CALL check_pf_availability(product_pf_id, data.quantity)
  2. IF NOT availability.available:
       THROW InsufficientStockError("Insufficient PF stock")
  
  3. remaining_to_reserve = data.quantity
  4. reservations = []
  
  5. FOR EACH lot IN (CALL get_available_lots_pf(product_pf_id)) WHILE remaining_to_reserve > 0:
       5a. reserve_from_lot = MIN(lot.quantity_remaining, remaining_to_reserve)
       5b. new_quantity = lot.quantity_remaining - reserve_from_lot
       5c. new_status = IF new_quantity = 0 THEN "RESERVED" ELSE "AVAILABLE"
       
       5d. UPDATE lots_pf 
           SET quantity_remaining = new_quantity,
               status = new_status,
               updated_at = NOW()
           WHERE id = lot.id
       
       5e. CALL record_stock_movement(user_id, {
             lot_id: lot.id,
             product_type: "PF",
             movement_type: "EXIT",
             quantity: reserve_from_lot,
             reference_type: "SALE",
             reference_id: data.sales_order_id
           })
       
       5f. reservations.APPEND({
             lot_id: lot.id,
             lot_number: lot.lot_number,
             quantity: reserve_from_lot,
             unit_cost: lot.unit_cost
           })
       
       5g. CALL emit_event("lot_pf", lot.id, "reserved", {
             quantity: reserve_from_lot,
             sales_order_id: data.sales_order_id
           })
       
       5h. remaining_to_reserve = remaining_to_reserve - reserve_from_lot
  
  6. RETURN {
       total_reserved: data.quantity,
       reservations: reservations,
       total_cost: SUM(r.quantity * r.unit_cost) FOR r IN reservations
     }

TABLES AFFECTED:
  - lots_pf (UPDATE, multiple)
  - stock_movements (INSERT, multiple)
  - _events (INSERT, multiple)

ERRORS:
  - InsufficientStockError: Not enough stock
```

---

## 6. Sales & Invoicing

### 6.1 create_client()

```
FUNCTION create_client(user_id, data)

INPUTS:
  user_id : UUID
  data    : {
    code         : string (unique)
    name         : string
    client_type  : "DISTRIBUTEUR" | "GROSSISTE" | "SUPERETTE" | "FAST_FOOD"
    phone        : string (optional)
    address      : string (optional)
    wilaya       : string (optional)
    nif          : string (optional, required for invoicing)
    nis          : string (optional)
    rc           : string (optional)
    ai           : string (optional, Article d'imposition)
    credit_limit : integer (centimes, default 0)
  }

PRECONDITIONS:
  - authorize(user_id, "write", "clients")
  - data.code is unique
  - IF data.nif provided: validate_nif(data.nif) = true

LOGIC:
  1. GENERATE id = new UUID
  2. INSERT INTO clients (id, code, name, client_type, phone, address, wilaya,
                          nif, nis, rc, ai, credit_limit, current_balance,
                          is_active, created_at, created_by)
     VALUES (id, UPPER(data.code), data.name, data.client_type, 
             data.phone, data.address, data.wilaya,
             data.nif, data.nis, data.rc, data.ai, 
             COALESCE(data.credit_limit, 0), 0,
             true, NOW(), user_id)
  3. CALL emit_event("client", id, "created", {code: data.code, name: data.name})
  4. RETURN id

TABLES AFFECTED:
  - clients (INSERT)
  - _events (INSERT)

ERRORS:
  - ValidationError: Duplicate code, invalid NIF
```

### 6.2 create_sales_order()

```
FUNCTION create_sales_order(user_id, data)

INPUTS:
  user_id : UUID
  data    : {
    client_id  : UUID
    order_date : date
    notes      : string (optional)
  }

PRECONDITIONS:
  - authorize(user_id, "write", "sales_orders")
  - client_id exists and is_active

LOGIC:
  1. GENERATE id = new UUID
  2. GENERATE order_number = "CMD-" + FORMAT(order_date, "YYMMDD") + "-" + SEQUENCE(5)
  3. SELECT client_type FROM clients WHERE id = data.client_id
  4. INSERT INTO sales_orders (id, order_number, client_id, client_type,
                               order_date, status, payment_status, notes,
                               total_ht, total_tva, total_ttc,
                               created_at, created_by)
     VALUES (id, order_number, client_id, client_type,
             order_date, "DRAFT", "UNPAID", notes,
             0, 0, 0, NOW(), user_id)
  5. CALL emit_event("sales_order", id, "created", {order_number, client_id})
  6. RETURN {id, order_number}

TABLES AFFECTED:
  - sales_orders (INSERT)
  - _events (INSERT)

ERRORS:
  - NotFoundError: Client not found
  - ValidationError: Client inactive
```

### 6.3 add_sales_order_line()

```
FUNCTION add_sales_order_line(user_id, order_id, data)

INPUTS:
  user_id  : UUID
  order_id : UUID
  data     : {
    product_pf_id : UUID
    quantity      : integer > 0
    unit_price_ht : integer (centimes)
    tva_rate      : decimal (0.19 or 0.09, default 0.19)
  }

PRECONDITIONS:
  - authorize(user_id, "write", "sales_orders")
  - sales_order exists with status = "DRAFT"
  - product_pf_id exists and is_active
  - Sufficient PF stock available (warning only, not blocking)

LOGIC:
  1. SELECT * FROM sales_orders WHERE id = order_id
  2. IF order.status != "DRAFT":
       THROW ValidationError("Cannot modify confirmed order")
  
  3. GENERATE line_id = new UUID
  4. tva_rate = COALESCE(data.tva_rate, 0.19)
  5. line_ht = data.quantity * data.unit_price_ht
  6. line_tva = FLOOR(line_ht * tva_rate)
  7. line_ttc = line_ht + line_tva
  
  8. INSERT INTO sales_order_lines (id, sales_order_id, product_pf_id,
                                    quantity, unit_price_ht, tva_rate,
                                    line_ht, line_tva, line_ttc)
     VALUES (line_id, order_id, product_pf_id, quantity, unit_price_ht,
             tva_rate, line_ht, line_tva, line_ttc)
  
  9. -- Recalculate order totals
  10. SELECT SUM(line_ht) AS total_ht, 
            SUM(line_tva) AS total_tva,
            SUM(line_ttc) AS total_ttc
      FROM sales_order_lines WHERE sales_order_id = order_id
  
  11. UPDATE sales_orders 
      SET total_ht = total_ht, total_tva = total_tva, total_ttc = total_ttc
      WHERE id = order_id
  
  12. -- Check stock availability (warning only)
  13. availability = CALL check_pf_availability(product_pf_id, data.quantity)
  
  14. RETURN {
        line_id: line_id,
        line_ttc: line_ttc,
        stock_warning: IF NOT availability.available 
                       THEN "Insufficient stock: " + availability.shortage + " short"
                       ELSE NULL
      }

TABLES AFFECTED:
  - sales_order_lines (INSERT)
  - sales_orders (UPDATE)

ERRORS:
  - NotFoundError: Order or product not found
  - ValidationError: Order not in DRAFT
```

### 6.4 confirm_sales_order()

```
FUNCTION confirm_sales_order(user_id, order_id)

INPUTS:
  user_id  : UUID
  order_id : UUID

PRECONDITIONS:
  - authorize(user_id, "write", "sales_orders")
  - sales_order exists with status = "DRAFT"
  - Order has at least 1 line
  - Sufficient stock for all lines

LOGIC:
  1. SELECT * FROM sales_orders WHERE id = order_id
  2. IF order.status != "DRAFT":
       THROW ValidationError("Order already confirmed or cancelled")
  
  3. SELECT * FROM sales_order_lines WHERE sales_order_id = order_id
  4. IF lines is empty:
       THROW ValidationError("Order must have at least one line")
  
  5. -- Verify and reserve stock for all lines
  6. FOR EACH line IN lines:
       6a. availability = CALL check_pf_availability(line.product_pf_id, line.quantity)
       6b. IF NOT availability.available:
             THROW InsufficientStockError("Insufficient stock for product", {
               product_id: line.product_pf_id,
               required: line.quantity,
               available: availability.total_available
             })
  
  7. -- All checks passed, reserve stock
  8. FOR EACH line IN lines:
       CALL reserve_pf_fifo(user_id, {
         product_pf_id: line.product_pf_id,
         quantity: line.quantity,
         sales_order_id: order_id
       })
  
  9. UPDATE sales_orders 
     SET status = "CONFIRMED", confirmed_at = NOW(), confirmed_by = user_id
     WHERE id = order_id
  
  10. -- Update client balance
  11. UPDATE clients 
      SET current_balance = current_balance + order.total_ttc
      WHERE id = order.client_id
  
  12. CALL emit_event("sales_order", order_id, "confirmed", {total_ttc: order.total_ttc})
  
  13. RETURN {status: "CONFIRMED", total_ttc: order.total_ttc}

TABLES AFFECTED:
  - sales_orders (UPDATE)
  - lots_pf (UPDATE, multiple)
  - stock_movements (INSERT, multiple)
  - clients (UPDATE)
  - _events (INSERT, multiple)

ERRORS:
  - ValidationError: No lines, wrong status
  - InsufficientStockError: Stock shortage
```

### 6.5 create_invoice()

```
FUNCTION create_invoice(user_id, sales_order_id)

INPUTS:
  user_id        : UUID
  sales_order_id : UUID

PRECONDITIONS:
  - authorize(user_id, "write", "invoices")
  - sales_order exists with status = "CONFIRMED"
  - No existing invoice for this order
  - Client has valid NIF for fiscal invoicing

LOGIC:
  1. SELECT * FROM sales_orders WHERE id = sales_order_id
  2. IF order.status != "CONFIRMED":
       THROW ValidationError("Can only invoice CONFIRMED orders")
  
  3. SELECT COUNT(*) FROM invoices WHERE sales_order_id = sales_order_id
  4. IF count > 0:
       THROW ValidationError("Invoice already exists for this order")
  
  5. SELECT * FROM clients WHERE id = order.client_id
  6. IF client.nif IS NULL OR client.nif = "":
       THROW ValidationError("Client must have NIF for invoicing")
  
  7. GENERATE id = new UUID
  8. GENERATE invoice_number = "FAC-" + FORMAT(NOW(), "YYMMDD") + "-" + SEQUENCE(5)
  
  9. -- Calculate timbre fiscal
  10. timbre = CALL calculate_timbre_fiscal(order.total_ttc)
  11. total_with_timbre = order.total_ttc + timbre
  
  12. INSERT INTO invoices (id, invoice_number, sales_order_id, client_id,
                           invoice_date, due_date, status, payment_status,
                           total_ht, total_tva, timbre_fiscal, total_ttc,
                           client_nif, client_nis, client_rc, client_ai,
                           created_at, created_by)
      VALUES (id, invoice_number, sales_order_id, client.id,
              TODAY(), TODAY() + 30,  -- 30 days payment term
              "VALIDATED", "UNPAID",
              order.total_ht, order.total_tva, timbre, total_with_timbre,
              client.nif, client.nis, client.rc, client.ai,
              NOW(), user_id)
  
  13. -- Copy order lines to invoice lines
  14. FOR EACH line IN (SELECT * FROM sales_order_lines WHERE sales_order_id = sales_order_id):
        INSERT INTO invoice_lines (id, invoice_id, product_pf_id, description,
                                   quantity, unit_price_ht, tva_rate,
                                   line_ht, line_tva, line_ttc)
        VALUES (new UUID, id, line.product_pf_id, 
                (SELECT name FROM products_pf WHERE id = line.product_pf_id),
                line.quantity, line.unit_price_ht, line.tva_rate,
                line.line_ht, line.line_tva, line.line_ttc)
  
  15. UPDATE sales_orders SET invoiced = true WHERE id = sales_order_id
  
  16. CALL emit_event("invoice", id, "created", {
        invoice_number: invoice_number,
        total_ttc: total_with_timbre
      })
  
  17. RETURN {
        invoice_id: id,
        invoice_number: invoice_number,
        total_ttc: total_with_timbre,
        timbre_fiscal: timbre
      }

TABLES AFFECTED:
  - invoices (INSERT)
  - invoice_lines (INSERT, multiple)
  - sales_orders (UPDATE)
  - _events (INSERT)

ERRORS:
  - NotFoundError: Order not found
  - ValidationError: Wrong status, already invoiced, missing NIF
```

### 6.6 record_payment()

```
FUNCTION record_payment(user_id, data)

INPUTS:
  user_id : UUID
  data    : {
    invoice_id     : UUID
    amount         : integer (centimes) > 0
    payment_method : "CASH" | "CHECK" | "TRANSFER"
    payment_date   : date
    check_number   : string (required if CHECK)
    check_bank     : string (required if CHECK)
    notes          : string (optional)
  }

PRECONDITIONS:
  - authorize(user_id, "write", "payments")
  - invoice_id exists with payment_status != "PAID"
  - amount > 0 and amount <= remaining amount

LOGIC:
  1. SELECT * FROM invoices WHERE id = data.invoice_id
  2. IF invoice.payment_status = "PAID":
       THROW ValidationError("Invoice already fully paid")
  
  3. SELECT COALESCE(SUM(amount), 0) AS already_paid 
     FROM payments 
     WHERE invoice_id = data.invoice_id AND status = "VALIDATED"
  
  4. remaining = invoice.total_ttc - already_paid
  5. IF data.amount > remaining:
       THROW ValidationError("Payment exceeds remaining amount", {
         remaining: remaining,
         attempted: data.amount
       })
  
  6. IF data.payment_method = "CHECK" AND (data.check_number IS NULL OR data.check_bank IS NULL):
       THROW ValidationError("Check number and bank required for check payment")
  
  7. GENERATE id = new UUID
  8. GENERATE reference = "REG-" + FORMAT(data.payment_date, "YYMMDD") + "-" + SEQUENCE(5)
  
  9. INSERT INTO payments (id, reference, invoice_id, client_id,
                          amount, payment_method, payment_date,
                          check_number, check_bank, status, notes,
                          created_at, created_by)
     VALUES (id, reference, invoice.id, invoice.client_id,
             data.amount, data.payment_method, data.payment_date,
             data.check_number, data.check_bank, "VALIDATED", data.notes,
             NOW(), user_id)
  
  10. -- Update invoice payment status
  11. new_paid = already_paid + data.amount
  12. new_payment_status = IF new_paid >= invoice.total_ttc THEN "PAID" 
                          ELSE IF new_paid > 0 THEN "PARTIAL"
                          ELSE "UNPAID"
  
  13. UPDATE invoices 
      SET payment_status = new_payment_status, amount_paid = new_paid
      WHERE id = invoice.id
  
  14. -- Update client balance
  15. UPDATE clients 
      SET current_balance = current_balance - data.amount
      WHERE id = invoice.client_id
  
  16. -- Update sales order payment status
  17. UPDATE sales_orders 
      SET payment_status = new_payment_status
      WHERE id = invoice.sales_order_id
  
  18. CALL emit_event("payment", id, "recorded", {
        invoice_id: invoice.id,
        amount: data.amount,
        method: data.payment_method
      })
  
  19. RETURN {
        payment_id: id,
        reference: reference,
        new_payment_status: new_payment_status,
        remaining: invoice.total_ttc - new_paid
      }

TABLES AFFECTED:
  - payments (INSERT)
  - invoices (UPDATE)
  - clients (UPDATE)
  - sales_orders (UPDATE)
  - _events (INSERT)

ERRORS:
  - NotFoundError: Invoice not found
  - ValidationError: Already paid, exceeds remaining, missing check info
```

---

## 7. Algerian Fiscal Rules

### 7.1 Constants

```
CONST TVA_STANDARD = 0.19        -- 19%
CONST TVA_REDUCED  = 0.09        -- 9% (food products may qualify)

-- Timbre Fiscal 2025 (Cash payments only)
CONST TIMBRE_THRESHOLD_MIN   = 30000      -- 300 DA in centimes
CONST TIMBRE_BRACKET_1_MAX   = 3000000    -- 30,000 DA in centimes
CONST TIMBRE_BRACKET_2_MAX   = 10000000   -- 100,000 DA in centimes
CONST TIMBRE_RATE_BRACKET_1  = 0.01       -- 1% (1 DA per 100 DA)
CONST TIMBRE_RATE_BRACKET_2  = 0.015      -- 1.5% (1.5 DA per 100 DA)
CONST TIMBRE_RATE_BRACKET_3  = 0.02       -- 2% (2 DA per 100 DA)
CONST TIMBRE_MINIMUM         = 500        -- 5 DA in centimes
CONST TIMBRE_BRACKET_SIZE    = 10000      -- 100 DA in centimes
```

### 7.2 validate_nif()

```
FUNCTION validate_nif(nif)

INPUTS:
  nif : string

LOGIC:
  1. cleaned = REMOVE_NON_DIGITS(nif)
  2. IF LENGTH(cleaned) != 15:
       RETURN false
  3. -- NIF structure: 15 digits
  4. -- Could add checksum validation if algorithm known
  5. RETURN true
```

### 7.3 validate_nis()

```
FUNCTION validate_nis(nis)

INPUTS:
  nis : string

LOGIC:
  1. cleaned = REMOVE_NON_DIGITS(nis)
  2. IF LENGTH(cleaned) != 11:
       RETURN false
  3. RETURN true
```

### 7.4 calculate_line_amounts()

```
FUNCTION calculate_line_amounts(quantity, unit_price_ht, tva_rate)

INPUTS:
  quantity      : integer
  unit_price_ht : integer (centimes)
  tva_rate      : decimal (0.19 or 0.09)

LOGIC:
  1. line_ht = quantity * unit_price_ht
  2. line_tva = FLOOR(line_ht * tva_rate)  -- Round down TVA
  3. line_ttc = line_ht + line_tva
  4. RETURN {line_ht, line_tva, line_ttc}
```

### 7.5 calculate_timbre_fiscal()

```
FUNCTION calculate_timbre_fiscal(total_ttc, payment_method)

INPUTS:
  total_ttc      : integer (centimes)
  payment_method : "ESPECES" | "CHEQUE" | "VIREMENT"

PRECONDITIONS:
  - total_ttc >= 0

LOGIC:
  -- RULE 1: Timbre fiscal applies ONLY to cash payments
  1. IF payment_method != "ESPECES":
       RETURN 0

  -- RULE 2: No timbre if total < 300 DA (30000 centimes)
  2. IF total_ttc < TIMBRE_THRESHOLD_MIN:
       RETURN 0

  -- RULE 3: Calculate number of 100 DA tranches using CEILING
  3. tranches = CEILING(total_ttc / TIMBRE_BRACKET_SIZE)

  -- RULE 4: Progressive rate calculation by brackets
  4. timbre = 0

  -- Bracket 1: 300 DA to 30,000 DA → 1% (1 DA per 100 DA tranche)
  5. IF total_ttc <= TIMBRE_BRACKET_1_MAX:
       timbre = tranches * 100  -- 1 DA = 100 centimes per tranche
       GOTO step 9

  -- Bracket 2: 30,001 DA to 100,000 DA → 1.5% (1.5 DA per 100 DA tranche)
  6. IF total_ttc <= TIMBRE_BRACKET_2_MAX:
       tranches_b1 = TIMBRE_BRACKET_1_MAX / TIMBRE_BRACKET_SIZE  -- 300 tranches
       tranches_b2 = tranches - tranches_b1
       timbre = (tranches_b1 * 100) + (tranches_b2 * 150)  -- 1 DA + 1.5 DA
       GOTO step 9

  -- Bracket 3: Above 100,000 DA → 2% (2 DA per 100 DA tranche)
  7. tranches_b1 = TIMBRE_BRACKET_1_MAX / TIMBRE_BRACKET_SIZE    -- 300 tranches
  8. tranches_b2 = (TIMBRE_BRACKET_2_MAX - TIMBRE_BRACKET_1_MAX) / TIMBRE_BRACKET_SIZE  -- 700 tranches
     tranches_b3 = tranches - tranches_b1 - tranches_b2
     timbre = (tranches_b1 * 100) + (tranches_b2 * 150) + (tranches_b3 * 200)

  -- RULE 5: Apply minimum (5 DA = 500 centimes)
  9. IF timbre < TIMBRE_MINIMUM:
       timbre = TIMBRE_MINIMUM

  10. RETURN timbre

EXAMPLES:
  -- Example 1: 500 DA cash → 5 tranches × 1 DA = 5 DA
  calculate_timbre_fiscal(50000, "ESPECES") = 500

  -- Example 2: 15,000 DA cash → 150 tranches × 1 DA = 150 DA
  calculate_timbre_fiscal(1500000, "ESPECES") = 15000

  -- Example 3: 50,000 DA cash
  --   Bracket 1: 300 tranches × 1 DA = 300 DA
  --   Bracket 2: 200 tranches × 1.5 DA = 300 DA
  --   Total = 600 DA
  calculate_timbre_fiscal(5000000, "ESPECES") = 60000

  -- Example 4: 150,000 DA cash
  --   Bracket 1: 300 tranches × 1 DA = 300 DA
  --   Bracket 2: 700 tranches × 1.5 DA = 1,050 DA
  --   Bracket 3: 500 tranches × 2 DA = 1,000 DA
  --   Total = 2,350 DA
  calculate_timbre_fiscal(15000000, "ESPECES") = 235000

  -- Example 5: Check payment → 0 DA (no timbre)
  calculate_timbre_fiscal(5000000, "CHEQUE") = 0

  -- Example 6: 200 DA cash → 0 DA (below threshold)
  calculate_timbre_fiscal(20000, "ESPECES") = 0

TABLES AFFECTED:
  - None (pure calculation)

ERRORS:
  - None (always returns valid integer >= 0)
```

### 7.6 Timbre Fiscal Summary (2025 Regulation)

```
RULE: Algerian Stamp Duty (Timbre Fiscal) - CASH PAYMENTS ONLY

┌─────────────────────────────────────────────────────────────────────┐
│  APPLICABILITY                                                      │
│  • Applies ONLY when payment_method = "ESPECES" (cash)              │
│  • Does NOT apply to: CHEQUE, VIREMENT (bank transfer)              │
│  • Calculated on TOTAL TTC (including TVA)                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  THRESHOLDS                                                         │
│  • Below 300 DA: No timbre (0 DA)                                   │
│  • Minimum timbre when applicable: 5 DA                             │
│  • No maximum cap                                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PROGRESSIVE RATE SCALE (per 100 DA bracket, using CEILING)         │
│                                                                     │
│  Amount (TTC)              │  Rate per 100 DA  │  Effective Rate    │
│  ─────────────────────────────────────────────────────────────────  │
│  300 DA → 30,000 DA        │  1.00 DA          │  1.0%              │
│  30,001 DA → 100,000 DA    │  1.50 DA          │  1.5%              │
│  > 100,000 DA              │  2.00 DA          │  2.0%              │
└─────────────────────────────────────────────────────────────────────┘

CALCULATION METHOD:
  1. Check payment method is ESPECES, else return 0
  2. Check total >= 300 DA, else return 0
  3. Calculate tranches = CEILING(total_ttc / 100 DA)
  4. Apply progressive rates to each bracket
  5. Ensure minimum 5 DA if any timbre applies
```

### 7.7 Invoice Fiscal Requirements

```
RULE: Invoice must contain:
  - Invoice number (sequential)
  - Invoice date
  - Client NIF (mandatory)
  - Client NIS (if available)
  - Client RC (if available)
  - Client Article d'imposition (if available)
  - Detail per line: quantity, unit price HT, TVA rate, TVA amount
  - Total HT
  - Total TVA (grouped by rate if multiple)
  - Payment method
  - Timbre fiscal (if payment_method = "ESPECES")
  - Total TTC (including timbre if applicable)
```

---

## 8. Offline Sync Events

### 8.1 emit_event()

```
FUNCTION emit_event(entity_type, entity_id, action, payload)

INPUTS:
  entity_type : string ("lot_mp", "production_order", "invoice", etc.)
  entity_id   : UUID
  action      : string ("created", "updated", "consumed", etc.)
  payload     : object (relevant changed data)

LOGIC:
  1. GENERATE event_id = new UUID
  2. device_id = GET_CURRENT_DEVICE_ID()
  3. user_id = GET_CURRENT_USER_ID()
  
  4. INSERT INTO _events (id, entity_type, entity_id, action, payload,
                          device_id, user_id, occurred_at, synced)
     VALUES (event_id, entity_type, entity_id, action, JSON(payload),
             device_id, user_id, NOW(), false)
  
  5. -- Add to sync queue
  6. INSERT INTO _sync_queue (id, event_id, priority, attempts, created_at)
     VALUES (new UUID, event_id, get_priority(entity_type, action), 0, NOW())
  
  7. RETURN event_id

TABLES AFFECTED:
  - _events (INSERT)
  - _sync_queue (INSERT)
```

### 8.2 get_priority()

```
FUNCTION get_priority(entity_type, action)

LOGIC:
  -- Critical: financial events
  IF entity_type IN ("invoice", "payment") AND action = "created":
    RETURN 3  -- CRITICAL
  
  -- High: stock-affecting events
  IF action IN ("consumed", "reserved", "validated"):
    RETURN 2  -- HIGH
  
  -- Normal: standard CRUD
  IF action IN ("created", "updated", "confirmed"):
    RETURN 1  -- NORMAL
  
  -- Low: everything else
  RETURN 0  -- LOW
```

### 8.3 get_pending_events()

```
FUNCTION get_pending_events(limit)

INPUTS:
  limit : integer (default 100)

LOGIC:
  1. SELECT e.*, sq.attempts, sq.priority
     FROM _events e
     JOIN _sync_queue sq ON sq.event_id = e.id
     WHERE e.synced = false AND sq.attempts < 5
     ORDER BY sq.priority DESC, e.occurred_at ASC
     LIMIT limit
  2. RETURN events

TABLES AFFECTED:
  - None (read only)
```

### 8.4 mark_events_synced()

```
FUNCTION mark_events_synced(event_ids)

INPUTS:
  event_ids : array of UUID

LOGIC:
  1. FOR EACH id IN event_ids:
       UPDATE _events SET synced = true, synced_at = NOW() WHERE id = id
       DELETE FROM _sync_queue WHERE event_id = id
  2. RETURN count of updated events

TABLES AFFECTED:
  - _events (UPDATE, multiple)
  - _sync_queue (DELETE, multiple)
```

### 8.5 apply_remote_event()

```
FUNCTION apply_remote_event(event)

INPUTS:
  event : {
    id          : UUID
    entity_type : string
    entity_id   : UUID
    action      : string
    payload     : object
    occurred_at : datetime
    user_id     : UUID
    device_id   : UUID
  }

PRECONDITIONS:
  - Event not already applied (check _events table)

LOGIC:
  1. -- Check if already applied
  2. SELECT COUNT(*) FROM _events WHERE id = event.id
  3. IF count > 0:
       RETURN {status: "SKIPPED", reason: "Already applied"}
  
  4. -- Apply based on entity type and action
  5. SWITCH event.entity_type:
       CASE "lot_mp":
         IF event.action = "consumed":
           -- Reduce lot quantity
           UPDATE lots_mp 
           SET quantity_remaining = quantity_remaining - event.payload.quantity
           WHERE id = event.entity_id
         -- ... other actions
       
       CASE "invoice":
         IF event.action = "created":
           -- Insert invoice if not exists
           INSERT OR IGNORE INTO invoices (...) VALUES (...)
         -- ... other actions
       
       -- ... other entity types
  
  6. -- Record event as applied
  7. INSERT INTO _events (id, entity_type, entity_id, action, payload,
                          device_id, user_id, occurred_at, synced, synced_at)
     VALUES (event.id, event.entity_type, event.entity_id, event.action,
             JSON(event.payload), event.device_id, event.user_id,
             event.occurred_at, true, NOW())
  
  8. RETURN {status: "APPLIED"}

TABLES AFFECTED:
  - Depends on entity_type
  - _events (INSERT)

ERRORS:
  - ConflictError: If applying would violate constraints (handle with conflict resolution)
```

### 8.6 Conflict Resolution Rules

```
RULE: Last-Write-Wins (Default)
  - Compare occurred_at timestamps
  - More recent event wins
  - Apply winning event, discard losing event

RULE: Server-Wins (For critical entities)
  - Entities: users, roles, price_lists
  - Server event always wins regardless of timestamp

RULE: Merge (For additive operations)
  - Entities: lots consumption, payments
  - Both events can be applied if mathematically consistent
  - If inconsistent: server-wins

RULE: Reject-If-Conflict
  - Entities: invoice numbers, lot numbers
  - If collision detected: reject local, regenerate
```

---

## Appendix A: QR Code Functions

### A.1 generate_qr_code()

```
FUNCTION generate_qr_code(entity_type, entity_id)

INPUTS:
  entity_type : "LMP" | "LPF" | "ORD" | "DLV"
  entity_id   : UUID

LOGIC:
  1. short_id = BASE32_ENCODE(entity_id)[0:8]  -- 8 char short ID
  2. qr_content = "MCG:" + entity_type + ":" + short_id
  3. RETURN qr_content

EXAMPLE:
  generate_qr_code("LMP", "550e8400-e29b-41d4-a716-446655440000")
  => "MCG:LMP:KUEXK5S7"
```

### A.2 parse_qr_code()

```
FUNCTION parse_qr_code(qr_content)

INPUTS:
  qr_content : string

LOGIC:
  1. IF NOT qr_content.STARTS_WITH("MCG:"):
       THROW ValidationError("Invalid QR format")
  
  2. parts = qr_content.SPLIT(":")
  3. IF LENGTH(parts) != 3:
       THROW ValidationError("Invalid QR format")
  
  4. entity_type = parts[1]
  5. short_id = parts[2]
  
  6. IF entity_type NOT IN ("LMP", "LPF", "ORD", "DLV"):
       THROW ValidationError("Unknown entity type")
  
  7. -- Lookup full ID from short_id
  8. SWITCH entity_type:
       CASE "LMP":
         SELECT id FROM lots_mp WHERE qr_code = qr_content
       CASE "LPF":
         SELECT id FROM lots_pf WHERE qr_code = qr_content
       CASE "ORD":
         SELECT id FROM production_orders WHERE qr_code = qr_content
       -- etc.
  
  9. IF id IS NULL:
       THROW NotFoundError("Entity not found for QR code")
  
  10. RETURN {type: entity_type, id: id, short_id: short_id}

ERRORS:
  - ValidationError: Invalid format
  - NotFoundError: Entity not found
```

---

## Appendix B: Reference Number Generation

### B.1 generate_reference()

```
FUNCTION generate_reference(prefix, date)

INPUTS:
  prefix : string ("LOT", "OF", "CMD", "FAC", "REG", "REC")
  date   : date

LOGIC:
  1. date_part = FORMAT(date, "YYMMDD")
  2. 
  3. -- Get next sequence for this prefix + date
  4. SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq
     FROM _sequences 
     WHERE prefix = prefix AND date_part = date_part
  
  5. IF next_seq = 1:
       INSERT INTO _sequences (prefix, date_part, seq) VALUES (prefix, date_part, 1)
     ELSE:
       UPDATE _sequences SET seq = next_seq WHERE prefix = prefix AND date_part = date_part
  
  6. sequence_part = LPAD(next_seq, 5, "0")  -- 00001, 00002, etc.
  7. RETURN prefix + "-" + date_part + "-" + sequence_part

EXAMPLE:
  generate_reference("FAC", "2025-01-20")
  => "FAC-250120-00001"
```

---

## Document End

**This specification is FINAL for Phase 1.**

Implementation must follow these rules exactly.  
Any deviation requires architectural review.
