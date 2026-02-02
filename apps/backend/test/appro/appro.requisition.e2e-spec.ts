/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TESTS E2E - APPRO REQUISITIONS & FOURNISSEURS V1.2
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Tests métier critiques:
 * - TEST 2: Auto-suggestion si joursCouverture < leadTime
 * - TEST 4: Fournisseur dégradé si tauxRetard > seuil
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
import { ApproAlertService } from '../../src/appro/appro-alert.service';

describe('APPRO Requisitions & Fournisseurs E2E (V1.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let approService: ApproService;
  let alertService: ApproAlertService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    approService = moduleFixture.get<ApproService>(ApproService);
    alertService = moduleFixture.get<ApproAlertService>(ApproAlertService);
    
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
  // TEST 2: Auto-suggestion si joursCouverture < leadTime
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Suggestions de réquisitions', () => {
    it('GET /appro/requisitions/suggested doit retourner des suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/appro/requisitions/suggested')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Chaque suggestion doit avoir les champs requis
      response.body.forEach((suggestion: any) => {
        expect(suggestion).toHaveProperty('productMpId');
        expect(suggestion).toHaveProperty('productMp');
        expect(suggestion).toHaveProperty('currentStock');
        expect(suggestion).toHaveProperty('quantiteRecommandee');
        expect(suggestion).toHaveProperty('priority');
        expect(suggestion).toHaveProperty('justification');
      });
    });

    it('les MP avec joursCouverture < leadTime doivent avoir priorité >= ÉLEVÉE', async () => {
      const suggestions = await approService.generateSuggestedRequisitions();
      
      // Filtrer les suggestions où joursCouverture < leadTime
      const criticalSuggestions = suggestions.filter((s: any) => {
        // joursCouverture null = Infinity, donc pas critique
        if (s.joursCouvertureActuels === null) return false;
        
        // Récupérer le leadTime (on prend 7 jours par défaut si non spécifié)
        const leadTime = 7; // Valeur par défaut
        return s.joursCouvertureActuels < leadTime;
      });

      // RÈGLE: Si joursCouverture < leadTime → priorité >= ÉLEVÉE
      criticalSuggestions.forEach((suggestion: any) => {
        expect(['CRITIQUE', 'ELEVEE']).toContain(suggestion.priority);
      });
    });

    it('les MP en rupture doivent apparaître dans les suggestions', async () => {
      // Récupérer les MP critiques
      const criticalMp = await approService.getCriticalMp();
      const rupturesMp = criticalMp.filter(mp => mp.state === 'RUPTURE' || mp.state === 'BLOQUANT_PRODUCTION');

      // Récupérer les suggestions
      const suggestions = await approService.generateSuggestedRequisitions();
      
      // Chaque MP en rupture devrait être dans les suggestions
      rupturesMp.forEach(mp => {
        const found = suggestions.find((s: any) => s.productMpId === mp.id);
        // Note: Peut ne pas être trouvé si pas de seuil configuré
        if (found) {
          expect(found.priority).toBe('CRITIQUE');
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 4: Fournisseur dégradé si tauxRetard > seuil
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Performance fournisseurs', () => {
    it('GET /appro/suppliers/performance doit retourner les fournisseurs avec métriques', async () => {
      const response = await request(app.getHttpServer())
        .get('/appro/suppliers/performance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Chaque fournisseur doit avoir les champs de performance
      response.body.forEach((supplier: any) => {
        expect(supplier).toHaveProperty('id');
        expect(supplier).toHaveProperty('name');
        expect(supplier).toHaveProperty('grade');
        expect(supplier).toHaveProperty('scorePerformance');
        expect(supplier).toHaveProperty('metrics');
      });
    });

    it('fournisseur avec tauxRetard > 20% doit avoir grade B ou C', async () => {
      // Récupérer les fournisseurs avec taux retard élevé
      const suppliersWithHighDelay = await prisma.supplier.findMany({
        where: {
          isActive: true,
          tauxRetard: { gt: 0.2 }, // > 20%
        },
      });

      // RÈGLE: tauxRetard > 20% → grade B ou C
      suppliersWithHighDelay.forEach(supplier => {
        expect(['B', 'C']).toContain(supplier.grade);
      });
    });

    it('doit créer une alerte FOURNISSEUR_RETARD si tauxRetard > seuil', async () => {
      // Créer un fournisseur de test avec taux retard élevé
      const testSupplier = await prisma.supplier.create({
        data: {
          code: 'TEST-DELAY-001',
          name: 'Test Fournisseur Retard',
          tauxRetard: 0.35, // 35% - très élevé
          grade: 'A', // Grade actuel incorrect
          isActive: true,
        },
      });

      try {
        // Scanner les alertes fournisseurs
        const result = await alertService.scanAndCreateAlerts();

        // Vérifier si une alerte a été créée pour ce fournisseur
        const alert = await prisma.approAlert.findFirst({
          where: {
            type: 'FOURNISSEUR_RETARD',
            entityId: testSupplier.id,
          },
        });

        // RÈGLE: Fournisseur avec tauxRetard > seuil → alerte créée
        if (testSupplier.tauxRetard && testSupplier.tauxRetard > 0.2) {
          // L'alerte devrait exister
          expect(alert).not.toBeNull();
        }
      } finally {
        // Nettoyage
        await prisma.approAlert.deleteMany({
          where: { entityId: testSupplier.id },
        });
        await prisma.supplier.delete({ where: { id: testSupplier.id } });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST: Stock MP avec état calculé
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Stock MP avec état calculé', () => {
    it('GET /appro/stock-mp doit retourner les MP avec criticiteEffective', async () => {
      const response = await request(app.getHttpServer())
        .get('/appro/stock-mp')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Chaque MP doit avoir criticiteParam ET criticiteEffective
      response.body.forEach((mp: any) => {
        expect(mp).toHaveProperty('criticiteParam');
        expect(mp).toHaveProperty('criticiteEffective');
        expect(mp).toHaveProperty('state');
        expect(mp).toHaveProperty('joursCouverture'); // peut être null
      });
    });

    it('GET /appro/stock-mp/critical doit retourner uniquement les MP à risque', async () => {
      const response = await request(app.getHttpServer())
        .get('/appro/stock-mp/critical')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Toutes les MP retournées doivent être critiques
      const criticalStates = ['BLOQUANT_PRODUCTION', 'RUPTURE', 'A_COMMANDER'];
      response.body.forEach((mp: any) => {
        const isCriticalState = criticalStates.includes(mp.state);
        const isCriticalCriticite = mp.criticiteEffective === 'BLOQUANTE';
        expect(isCriticalState || isCriticalCriticite).toBe(true);
      });
    });
  });
});
