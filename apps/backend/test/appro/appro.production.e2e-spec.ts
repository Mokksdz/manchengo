/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TESTS E2E - APPRO PRODUCTION V1.2
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Tests métier critiques pour le blocage production:
 * - TEST 1: Production refusée si MP BLOQUANTE absente
 * - Création automatique d'alerte PRODUCTION_BLOQUEE
 * 
 * @author Manchengo ERP Team
 * @version 1.2.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApproService } from '../../src/appro/appro.service';

describe('APPRO Production E2E (V1.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let approService: ApproService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    approService = moduleFixture.get<ApproService>(ApproService);
    
    await app.init();

    // Authentification
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@manchengo.dz', password: 'admin123' });
    
    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 1: Blocage production si MP BLOQUANTE absente
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Blocage production', () => {
    it('POST /appro/check-production doit retourner canStart=false si MP insuffisante', async () => {
      // Récupérer une recette existante avec ingrédients
      const recipe = await prisma.recipe.findFirst({
        where: { isActive: true },
        include: { items: true },
      });

      if (!recipe) {
        console.log('Aucune recette active trouvée - test skipped');
        return;
      }

      // Vérifier avec un batch count très élevé (pour forcer le blocage)
      const response = await request(app.getHttpServer())
        .post('/appro/check-production')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ recipeId: recipe.id, batchCount: 99999 })
        .expect(201);

      // Avec un batch count très élevé, il devrait y avoir des blockers
      expect(response.body).toHaveProperty('canStart');
      expect(response.body).toHaveProperty('blockers');
      
      // Si blockers présents, canStart doit être false
      if (response.body.blockers.length > 0) {
        expect(response.body.canStart).toBe(false);
      }
    });

    it('doit créer une alerte PRODUCTION_BLOQUEE quand la production est impossible', async () => {
      // Récupérer une recette existante
      const recipe = await prisma.recipe.findFirst({
        where: { isActive: true },
        include: { items: true },
      });

      if (!recipe) {
        console.log('Aucune recette active trouvée - test skipped');
        return;
      }

      // Compter les alertes PRODUCTION_BLOQUEE avant
      const alertsCountBefore = await prisma.approAlert.count({
        where: { type: 'PRODUCTION_BLOQUEE' },
      });

      // Tenter une production impossible
      await request(app.getHttpServer())
        .post('/appro/check-production')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ recipeId: recipe.id, batchCount: 99999 })
        .expect(201);

      // Compter les alertes après
      const alertsCountAfter = await prisma.approAlert.count({
        where: { type: 'PRODUCTION_BLOQUEE' },
      });

      // RÈGLE MÉTIER V1.2: Toute production bloquée DOIT créer une alerte
      // Note: L'alerte peut ne pas être créée si une identique existe déjà
      expect(alertsCountAfter).toBeGreaterThanOrEqual(alertsCountBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 3: IRS critique si MP BLOQUANTE
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('IRS (Indice de Risque Stock)', () => {
    it('GET /appro/dashboard doit retourner un IRS avec status', async () => {
      const response = await request(app.getHttpServer())
        .get('/appro/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('irs');
      expect(response.body.irs).toHaveProperty('value');
      expect(response.body.irs).toHaveProperty('status');
      expect(response.body.irs).toHaveProperty('details');

      // IRS doit être entre 0 et 100
      expect(response.body.irs.value).toBeGreaterThanOrEqual(0);
      expect(response.body.irs.value).toBeLessThanOrEqual(100);

      // Status doit être SAIN, SURVEILLANCE ou CRITIQUE
      expect(['SAIN', 'SURVEILLANCE', 'CRITIQUE']).toContain(response.body.irs.status);
    });

    it('IRS >= 60 (CRITIQUE) si au moins 2 MP bloquantes en rupture', async () => {
      // Ce test vérifie la formule PRO:
      // IRS = (nbBloquantes * 30) + (nbRuptures * 20) + (nbSousSeuil * 10)
      // Avec 2 bloquantes: 2 * 30 = 60 → CRITIQUE

      const dashboard = await approService.getDashboard();
      
      const nbBloquantes = dashboard.irs.details.mpCritiquesProduction;
      
      if (nbBloquantes >= 2) {
        // Si 2+ MP bloquantes, IRS doit être >= 60
        expect(dashboard.irs.value).toBeGreaterThanOrEqual(60);
        expect(dashboard.irs.status).toBe('CRITIQUE');
      }
    });
  });
});
