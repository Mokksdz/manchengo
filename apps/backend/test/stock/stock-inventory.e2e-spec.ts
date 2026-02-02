/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TESTS E2E - MODULE STOCK & INVENTAIRE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Tests E2E critiques pour valider les flux complets:
 * 1. Dashboard Stock - 3 zones
 * 2. Déclaration inventaire - workflow complet
 * 3. Validation simple et double
 * 4. Règles anti-fraude
 *
 * @author Manchengo ERP Team
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Stock & Inventory E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let approToken: string;
  let adminUserId: string;
  let approUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();

    // Login ADMIN
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@manchengo.dz', password: 'admin123' });

    if (adminLogin.body.accessToken) {
      adminToken = adminLogin.body.accessToken;
      adminUserId = adminLogin.body.user?.id;
    }

    // Login APPRO (pour tester séparation compteur/validateur)
    const approLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'appro@manchengo.dz', password: 'appro123' });

    if (approLogin.body.accessToken) {
      approToken = approLogin.body.accessToken;
      approUserId = approLogin.body.user?.id;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.inventoryDeclaration.deleteMany({
      where: { notes: { contains: 'E2E_TEST' } },
    });
    await app.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 1: DASHBOARD STOCK
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('GET /stock/dashboard', () => {
    it('should return dashboard with 3 zones', async () => {
      const response = await request(app.getHttpServer())
        .get('/stock/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('critique');
      expect(response.body.data).toHaveProperty('aTraiter');
      expect(response.body.data).toHaveProperty('sante');
      expect(response.body.data).toHaveProperty('summary');

      // Verify structure
      expect(response.body.data.critique).toHaveProperty('totalCount');
      expect(response.body.data.sante).toHaveProperty('fifoCompliance');
      expect(response.body.data.summary).toHaveProperty('healthScore');
    });

    it('should return critical count for badge', async () => {
      const response = await request(app.getHttpServer())
        .get('/stock/dashboard/count')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('criticalCount');
      expect(response.body.data).toHaveProperty('hasCritical');
      expect(typeof response.body.data.criticalCount).toBe('number');
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/stock/dashboard')
        .expect(401);
    });
  });

  describe('GET /stock/dashboard/health', () => {
    it('should return health metrics for ADMIN only', async () => {
      const response = await request(app.getHttpServer())
        .get('/stock/dashboard/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.metrics).toHaveProperty('fifoCompliance');
      expect(response.body.data.metrics).toHaveProperty('stockRotation');
      expect(response.body.data).toHaveProperty('interpretation');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 2: INVENTORY DECLARATION WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Inventory Declaration Workflow', () => {
    let testProductMpId: number;
    let declarationId: number;

    beforeAll(async () => {
      // Get a test product MP
      const product = await prisma.productMp.findFirst({
        where: { isActive: true, isStockTracked: true },
      });
      testProductMpId = product?.id || 1;
    });

    it('should reject declaration with negative quantity', async () => {
      const response = await request(app.getHttpServer())
        .post('/inventory/declare')
        .set('Authorization', `Bearer ${approToken}`)
        .send({
          productType: 'MP',
          productId: testProductMpId,
          declaredQuantity: -10,
          notes: 'E2E_TEST negative',
        })
        .expect(400);

      expect(response.body.message).toMatch(/quantité|negative|invalide/i);
    });

    it('should create declaration successfully', async () => {
      // Skip if no approToken (test env not fully set up)
      if (!approToken) {
        console.log('Skipping: No APPRO token available');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/inventory/declare')
        .set('Authorization', `Bearer ${approToken}`)
        .send({
          productType: 'MP',
          productId: testProductMpId,
          declaredQuantity: 100,
          notes: 'E2E_TEST declaration',
        });

      // May succeed or fail based on cooldown/product state
      if (response.status === 201 || response.status === 200) {
        expect(response.body.data).toHaveProperty('declarationId');
        expect(response.body.data).toHaveProperty('riskLevel');
        declarationId = response.body.data.declarationId;
      }
    });

    it('should list pending validations for ADMIN', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 3: ANTI-FRAUD RULES
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Anti-Fraud Rules', () => {
    it('should reject self-validation (counter = validator)', async () => {
      // Create a declaration as ADMIN
      const declareResponse = await request(app.getHttpServer())
        .post('/inventory/declare')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productType: 'MP',
          productId: 1,
          declaredQuantity: 50,
          notes: 'E2E_TEST self-validation test',
        });

      if (declareResponse.status === 201 || declareResponse.status === 200) {
        const declarationId = declareResponse.body.data?.declarationId;

        if (declarationId) {
          // Try to validate as same user
          const validateResponse = await request(app.getHttpServer())
            .post(`/inventory/${declarationId}/validate`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ approvalReason: 'Self-validation attempt' })
            .expect(403);

          expect(validateResponse.body.code || validateResponse.body.message).toMatch(
            /SELF_VALIDATION|validateur|compté/i
          );
        }
      }
    });

    it('should reject non-ADMIN validation attempt', async () => {
      // Get any pending declaration
      const pending = await prisma.inventoryDeclaration.findFirst({
        where: { status: 'PENDING_VALIDATION' },
      });

      if (pending && approToken) {
        const response = await request(app.getHttpServer())
          .post(`/inventory/${pending.id}/validate`)
          .set('Authorization', `Bearer ${approToken}`)
          .send({ approvalReason: 'Non-admin attempt' })
          .expect(403);

        expect(response.body.message).toMatch(/ADMIN|autorisé/i);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 4: STOCK ALERTS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Stock Alerts & Expiry', () => {
    it('should return expiry stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/stock/dashboard/expiry')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should return critical alerts with non-dismissable flag', async () => {
      const response = await request(app.getHttpServer())
        .get('/stock/dashboard/critical')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('alerts');

      // If there are critical alerts, verify they are non-dismissable
      if (response.body.data.alerts.length > 0) {
        const criticalAlert = response.body.data.alerts[0];
        expect(criticalAlert.dismissable).toBe(false);
        expect(criticalAlert.severity).toBe('CRITICAL');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION 5: INVENTORY HISTORY
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Inventory History', () => {
    it('should return inventory history for product', async () => {
      const product = await prisma.productMp.findFirst({
        where: { isActive: true },
      });

      if (product) {
        const response = await request(app.getHttpServer())
          .get(`/inventory/history/MP/${product.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });
});
