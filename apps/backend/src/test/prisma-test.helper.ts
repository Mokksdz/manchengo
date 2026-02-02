/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRISMA TEST HELPER - Database isolation for business tests
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * WHY: ERP tests must be isolated. Each test must start with a known state.
 * Shared mutable state = flaky tests = missed regressions = financial loss.
 * 
 * STRATEGY:
 * - Use transactions that rollback after each test
 * - Seed minimal data required for each test
 * - Never share state between tests
 */

import { PrismaClient } from '@prisma/client';

// Use a separate test database (SQLite for speed, or test PostgreSQL)
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'file:./test.db';

let prismaClient: PrismaClient | null = null;

/**
 * Get or create the Prisma client for tests
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_URL,
        },
      },
      log: process.env.DEBUG_PRISMA ? ['query', 'error'] : ['error'],
    });
  }
  return prismaClient;
}

/**
 * Clean all tables in the database
 * Order matters due to foreign key constraints
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in reverse dependency order
  const deleteOrder = [
    'stockMovement',
    'productionConsumption',
    'lotPf',
    'lotMp',
    'productionOrder',
    'receptionMpLine',
    'receptionMp',
    'recipeItem',
    'recipe',
    'demandeApprovisionnementMp',
    'alert',
    'productPf',
    'productMp',
    'supplier',
    'refreshToken',
    'device',
    'user',
  ];

  for (const table of deleteOrder) {
    try {
      // @ts-expect-error - Dynamic table access
      await prisma[table]?.deleteMany({});
    } catch {
      // Table might not exist or be empty, continue
    }
  }
}

/**
 * Seed minimal test data
 * Returns IDs for use in tests
 */
export async function seedTestData(prisma: PrismaClient): Promise<TestData> {
  // Create test user
  const adminUser = await prisma.user.create({
    data: {
      id: 'test-admin-user',
      code: 'ADMIN001',
      email: 'admin@test.manchengo.dz',
      passwordHash: '$2b$10$test-hash', // Not used in unit tests
      firstName: 'Test',
      lastName: 'Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const productionUser = await prisma.user.create({
    data: {
      id: 'test-production-user',
      code: 'PROD001',
      email: 'production@test.manchengo.dz',
      passwordHash: '$2b$10$test-hash',
      firstName: 'Test',
      lastName: 'Production',
      role: 'PRODUCTION',
      isActive: true,
    },
  });

  const approUser = await prisma.user.create({
    data: {
      id: 'test-appro-user',
      code: 'APPRO001',
      email: 'appro@test.manchengo.dz',
      passwordHash: '$2b$10$test-hash',
      firstName: 'Test',
      lastName: 'Appro',
      role: 'APPRO',
      isActive: true,
    },
  });

  const commercialUser = await prisma.user.create({
    data: {
      id: 'test-commercial-user',
      code: 'COM001',
      email: 'commercial@test.manchengo.dz',
      passwordHash: '$2b$10$test-hash',
      firstName: 'Test',
      lastName: 'Commercial',
      role: 'COMMERCIAL',
      isActive: true,
    },
  });

  // Create test supplier
  const supplier = await prisma.supplier.create({
    data: {
      code: 'FTEST001',
      name: 'Fournisseur Test',
      rc: 'RC123456',
      nif: '123456789012345',
      ai: 'AI12345',
      phone: '0555000000',
      isActive: true,
      grade: 'A',
      leadTimeJours: 3,
    },
  });

  // Create test MP products
  const mpLait = await prisma.productMp.create({
    data: {
      code: 'MP-LAIT',
      name: 'Lait Pasteurisé',
      unit: 'L',
      category: 'RAW_MATERIAL',
      minStock: 100,
      seuilSecurite: 50,
      seuilCommande: 150,
      isActive: true,
      isStockTracked: true,
      criticite: 'BLOQUANTE',
      fournisseurPrincipalId: supplier.id,
    },
  });

  const mpPresure = await prisma.productMp.create({
    data: {
      code: 'MP-PRESURE',
      name: 'Présure',
      unit: 'L',
      category: 'ADDITIVE',
      minStock: 10,
      seuilSecurite: 5,
      seuilCommande: 15,
      isActive: true,
      isStockTracked: true,
      criticite: 'HAUTE',
    },
  });

  const mpSel = await prisma.productMp.create({
    data: {
      code: 'MP-SEL',
      name: 'Sel',
      unit: 'KG',
      category: 'ADDITIVE',
      minStock: 20,
      isActive: true,
      isStockTracked: true,
      criticite: 'FAIBLE',
    },
  });

  // Create test PF product
  const pfFromage = await prisma.productPf.create({
    data: {
      code: 'PF-MANCHENGO',
      name: 'Fromage Manchengo',
      unit: 'KG',
      priceHt: 150000, // 1500 DA
      minStock: 50,
      isActive: true,
    },
  });

  // Create recipe
  const recipe = await prisma.recipe.create({
    data: {
      name: 'Recette Manchengo Standard',
      productPfId: pfFromage.id,
      batchWeight: 10000, // 10 kg
      outputQuantity: 10, // 10 kg fromage
      shelfLifeDays: 90,
      lossTolerance: 0.05, // 5%
      isActive: true,
      items: {
        create: [
          {
            productMpId: mpLait.id,
            name: 'Lait Pasteurisé',
            quantity: 100, // 100L per batch
            unit: 'L',
            isMandatory: true,
            affectsStock: true,
            sortOrder: 1,
          },
          {
            productMpId: mpPresure.id,
            name: 'Présure',
            quantity: 0.5, // 0.5L per batch
            unit: 'L',
            isMandatory: true,
            affectsStock: true,
            sortOrder: 2,
          },
          {
            productMpId: mpSel.id,
            name: 'Sel',
            quantity: 2, // 2kg per batch
            unit: 'KG',
            isMandatory: false,
            affectsStock: true,
            sortOrder: 3,
          },
        ],
      },
    },
  });

  return {
    users: {
      admin: adminUser,
      production: productionUser,
      appro: approUser,
      commercial: commercialUser,
    },
    supplier,
    productsMp: {
      lait: mpLait,
      presure: mpPresure,
      sel: mpSel,
    },
    productsPf: {
      fromage: pfFromage,
    },
    recipe,
  };
}

/**
 * Add stock to a MP product via a reception movement
 */
export async function addMpStock(
  prisma: PrismaClient,
  productMpId: number,
  quantity: number,
  userId: string,
): Promise<void> {
  await prisma.stockMovement.create({
    data: {
      movementType: 'IN',
      productType: 'MP',
      origin: 'RECEPTION',
      productMpId,
      quantity,
      userId,
      reference: `TEST-REC-${Date.now()}`,
    },
  });
}

/**
 * Add stock to a PF product via a production movement
 */
export async function addPfStock(
  prisma: PrismaClient,
  productPfId: number,
  quantity: number,
  userId: string,
): Promise<void> {
  await prisma.stockMovement.create({
    data: {
      movementType: 'IN',
      productType: 'PF',
      origin: 'PRODUCTION_IN',
      productPfId,
      quantity,
      userId,
      reference: `TEST-PROD-${Date.now()}`,
    },
  });
}

/**
 * Test data interface
 */
export interface TestData {
  users: {
    admin: { id: string; role: string };
    production: { id: string; role: string };
    appro: { id: string; role: string };
    commercial: { id: string; role: string };
  };
  supplier: { id: number };
  productsMp: {
    lait: { id: number; code: string; minStock: number };
    presure: { id: number; code: string };
    sel: { id: number; code: string };
  };
  productsPf: {
    fromage: { id: number; code: string };
  };
  recipe: { id: number };
}
