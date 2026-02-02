# PHASE 2: CRITICAL BUSINESS TESTING - STRATEGY & IMPLEMENTATION

**Date**: 5 Janvier 2026  
**Statut**: ✅ IMPLÉMENTÉ  
**Framework**: Jest + Prisma

---

## 1. TEST STRATEGY

### Philosophy: Protect the Money Flow

We test **business invariants**, not framework behavior.

| ✅ WE TEST | ❌ WE DON'T TEST |
|-----------|-----------------|
| Stock cannot go negative | DTO validation |
| Production state machine | Controller routing |
| Role-based access control | HTTP status codes |
| Threshold calculations | Framework internals |
| Movement combination rules | Database queries |

### Why These Services?

| Service | Business Risk | Financial Impact |
|---------|---------------|------------------|
| **StockService** | Overselling, negative inventory | Customer complaints, lost sales |
| **ProductionService** | Double completion, insufficient MP | Inventory corruption, production delays |
| **ApproService** | Wrong alerts, missed stockouts | Production stoppage, lost revenue |

---

## 2. FILE STRUCTURE

```
apps/backend/src/
├── test/
│   └── prisma-test.helper.ts      # DB isolation, seeding, cleanup
├── stock/
│   ├── stock.service.ts
│   └── stock.service.spec.ts      # 20+ business invariant tests
├── production/
│   ├── production.service.ts
│   └── production.service.spec.ts # 15+ workflow tests
├── appro/
│   ├── appro.service.ts
│   └── appro.service.spec.ts      # 15+ supply chain tests
```

### Naming Conventions

- Test files: `*.service.spec.ts` (co-located with service)
- Test helpers: `src/test/*.helper.ts`
- Describe blocks: `INVARIANT: <business rule>`
- Test names: `should <expected behavior> when <condition>`

---

## 3. INVARIANTS TESTED

### StockService (20+ tests)

| # | Invariant | Risk if Broken |
|---|-----------|----------------|
| 1 | Stock cannot go negative | Overselling |
| 2 | MP cannot be sold (VENTE origin) | Audit corruption |
| 3 | PF cannot be received (RECEPTION origin) | Audit corruption |
| 4 | Role COMMERCIAL cannot do RECEPTION | Security breach |
| 5 | Role PRODUCTION cannot do VENTE | Security breach |
| 6 | Only ADMIN can do INVENTAIRE | Unauthorized adjustments |
| 7 | Quantity must be > 0 | Invalid movements |
| 8 | OUT requires sufficient stock | Negative inventory |

### ProductionService (15+ tests)

| # | Invariant | Risk if Broken |
|---|-----------|----------------|
| 1 | Cannot create order without recipe | Orphan orders |
| 2 | Cannot start without sufficient MP | Production failure |
| 3 | Cannot start non-PENDING order | State machine corruption |
| 4 | Cannot complete non-IN_PROGRESS order | State machine corruption |
| 5 | Cannot complete twice | Duplicate stock creation |
| 6 | Cannot cancel COMPLETED order | Audit trail corruption |
| 7 | Starting creates MP OUT movements | Stock tracking |
| 8 | Completing creates PF IN movement | Stock tracking |
| 9 | Completing creates PF lot | Traceability |

### ApproService (15+ tests)

| # | Invariant | Risk if Broken |
|---|-----------|----------------|
| 1 | RUPTURE when stock = 0 | Missed alerts |
| 2 | BLOQUANT_PRODUCTION when rupture + recipe | Production blind spot |
| 3 | IRS increases with severity | Wrong priorities |
| 4 | IRS capped at 100 | Display issues |
| 5 | seuilCommande > seuilSecurite | Invalid thresholds |
| 6 | Stock = SUM(IN) - SUM(OUT) | Inventory corruption |
| 7 | Critical MP detection | Missed stockouts |

---

## 4. DATA SETUP STRATEGY

### Test Database Isolation

```typescript
// prisma-test.helper.ts
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'file:./test.db';
```

### Cleanup Between Tests

```typescript
beforeEach(async () => {
  await cleanDatabase(prisma);  // Delete all in reverse FK order
  testData = await seedTestData(prisma);  // Minimal seed
});
```

### Minimal Seed Data

```typescript
// Created by seedTestData():
- 4 users (ADMIN, PRODUCTION, APPRO, COMMERCIAL)
- 1 supplier
- 3 MP products (lait, presure, sel)
- 1 PF product (fromage)
- 1 recipe with 3 items
```

### Stock Helpers

```typescript
// Add stock without going through full service validation
await addMpStock(prisma, productMpId, quantity, userId);
await addPfStock(prisma, productPfId, quantity, userId);
```

---

## 5. RUNNING TESTS

### Commands

```bash
# Run all tests
cd apps/backend
npm test

# Run specific service tests
npm test -- stock.service.spec.ts
npm test -- production.service.spec.ts
npm test -- appro.service.spec.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Environment Setup

```bash
# Create test database
TEST_DATABASE_URL="file:./test.db" npx prisma db push

# Or use PostgreSQL test database
TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/manchengo_test"
```

---

## 6. COVERAGE GOALS

### Focused Coverage (Not Vanity Metrics)

| Target | Metric | Rationale |
|--------|--------|-----------|
| StockService | 90%+ | Financial critical |
| ProductionService | 85%+ | Workflow critical |
| ApproService | 80%+ | Supply chain critical |
| Controllers | 0% | Not business logic |
| DTOs | 0% | Framework validation |

### What We Measure

✅ Branch coverage on business decision points  
✅ All error paths tested  
✅ Edge cases (zero stock, exact match, boundary values)  
❌ Line coverage for its own sake  
❌ Coverage of framework-generated code

---

## 7. CI INTEGRATION

### Add to `.github/workflows/ci.yml`:

```yaml
- name: Run Business Tests
  run: npm test -- --ci --coverage
  working-directory: apps/backend
  env:
    TEST_DATABASE_URL: "file:./test.db"

- name: Check Coverage Thresholds
  run: |
    npm test -- --coverage --coverageThreshold='{
      "src/stock/*.ts": { "branches": 80 },
      "src/production/*.ts": { "branches": 75 },
      "src/appro/*.ts": { "branches": 70 }
    }'
```

---

## 8. EXAMPLE TEST PATTERNS

### Pattern: Testing Business Exception

```typescript
it('should throw when OUT movement exceeds available stock', async () => {
  // GIVEN: Known state
  await addMpStock(prisma, productId, 50, userId);

  // WHEN: Violating invariant
  const attempt = service.createMovement({
    quantity: 100,  // More than available
    // ...
  });

  // THEN: Business exception with clear message
  await expect(attempt).rejects.toThrow(BadRequestException);
  await expect(attempt).rejects.toThrow(/Stock insuffisant/);
});
```

### Pattern: Testing State Machine

```typescript
it('should throw when starting non-PENDING order', async () => {
  // GIVEN: Order in wrong state
  const order = await createOrder();
  await service.start(order.id);  // Now IN_PROGRESS

  // WHEN: Attempting invalid transition
  const attempt = service.start(order.id);

  // THEN: State machine enforced
  await expect(attempt).rejects.toThrow(/statut actuel = IN_PROGRESS/);
});
```

### Pattern: Testing RBAC

```typescript
it('should throw when COMMERCIAL tries RECEPTION', () => {
  expect(() => {
    service.validateRoleForOrigin('RECEPTION', 'COMMERCIAL');
  }).toThrow(ForbiddenException);
});
```

---

## 9. FILES CREATED

| File | Purpose |
|------|---------|
| `src/test/prisma-test.helper.ts` | DB isolation, seeding, cleanup |
| `src/stock/stock.service.spec.ts` | Stock invariant tests |
| `src/production/production.service.spec.ts` | Production workflow tests |
| `src/appro/appro.service.spec.ts` | Supply chain tests |

---

## 10. NEXT STEPS (PHASE 3)

1. **Add RecipeService tests** - Recipe creation, stock check
2. **Add LotsService tests** - FIFO consumption, expiry
3. **Add AuthService tests** - Token validation, session
4. **E2E tests with Supertest** - Full API flows
5. **Performance tests** - Concurrent production orders

---

## CONCLUSION

Phase 2 establishes **50+ business invariant tests** that:

- ✅ Fail when a business rule is violated
- ✅ Run in isolation (no shared state)
- ✅ Use minimal test data
- ✅ Document expected behavior
- ✅ Protect the money flow

**If these tests pass, the ERP's core financial operations are protected.**
