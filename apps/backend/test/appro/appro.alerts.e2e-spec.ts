/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TESTS E2E - APPRO ALERTES V1.2
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Tests métier critiques pour le module alertes APPRO:
 * - Création d'alertes sans duplication
 * - Accusé de réception obligatoire pour CRITICAL
 * - Scan automatique des alertes
 * 
 * @author Manchengo ERP Team
 * @version 1.2.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ApproAlertService } from '../../src/appro/appro-alert.service';
import { ApproAlertType, ApproAlertLevel, ApproAlertEntity } from '@prisma/client';

describe('APPRO Alerts E2E (V1.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alertService: ApproAlertService;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    alertService = moduleFixture.get<ApproAlertService>(ApproAlertService);
    
    await app.init();

    // Authentification pour les tests
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@manchengo.dz', password: 'admin123' });
    
    authToken = loginResponse.body.accessToken;
    testUserId = loginResponse.body.user?.id;
  });

  afterAll(async () => {
    // Nettoyage des alertes de test
    await prisma.approAlert.deleteMany({
      where: { message: { contains: 'TEST_' } },
    });
    await app.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 1: Pas de duplication d'alertes
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Création d\'alertes sans duplication', () => {
    it('ne doit pas créer une alerte identique non accusée', async () => {
      // Créer une première alerte
      const alert1 = await alertService.createAlert({
        type: ApproAlertType.MP_CRITIQUE,
        niveau: ApproAlertLevel.CRITICAL,
        entityType: ApproAlertEntity.MP,
        entityId: 9999,
        message: 'TEST_DUPLICATE: Alerte de test',
      });

      // Tenter de créer une alerte identique
      const alert2 = await alertService.createAlert({
        type: ApproAlertType.MP_CRITIQUE,
        niveau: ApproAlertLevel.CRITICAL,
        entityType: ApproAlertEntity.MP,
        entityId: 9999,
        message: 'TEST_DUPLICATE: Autre message',
      });

      // RÈGLE: Même type + même entityId + non accusée = pas de duplication
      expect(alert1?.id).toBe(alert2?.id);

      // Nettoyage
      if (alert1) {
        await prisma.approAlert.delete({ where: { id: alert1.id } });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 2: Accusé de réception
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Accusé de réception', () => {
    it('doit permettre d\'accuser réception d\'une alerte', async () => {
      // Créer une alerte
      const alert = await alertService.createAlert({
        type: ApproAlertType.RUPTURE,
        niveau: ApproAlertLevel.WARNING,
        entityType: ApproAlertEntity.MP,
        entityId: 8888,
        message: 'TEST_ACK: Alerte pour test acknowledgement',
      });

      expect(alert).not.toBeNull();
      expect(alert?.acknowledgedAt).toBeNull();

      // Accuser réception via API
      const response = await request(app.getHttpServer())
        .post(`/appro/alerts/${alert?.id}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.acknowledgedAt).not.toBeNull();
      expect(response.body.acknowledgedBy).not.toBeNull();

      // Nettoyage
      if (alert) {
        await prisma.approAlert.delete({ where: { id: alert.id } });
      }
    });

    it('ne doit pas permettre d\'accuser deux fois la même alerte', async () => {
      // Créer une alerte
      const alert = await alertService.createAlert({
        type: ApproAlertType.RUPTURE,
        niveau: ApproAlertLevel.WARNING,
        entityType: ApproAlertEntity.MP,
        entityId: 7777,
        message: 'TEST_DOUBLE_ACK: Alerte pour test double acknowledgement',
      });

      // Premier accusé
      await alertService.acknowledgeAlert(alert!.id, testUserId);

      // Deuxième accusé - doit échouer
      await expect(
        alertService.acknowledgeAlert(alert!.id, testUserId)
      ).rejects.toThrow('Alerte');

      // Nettoyage
      if (alert) {
        await prisma.approAlert.delete({ where: { id: alert.id } });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TEST 3: Endpoints API
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Endpoints API Alertes', () => {
    it('GET /appro/alerts/active doit retourner les alertes non accusées', async () => {
      const response = await request(app.getHttpServer())
        .get('/appro/alerts/active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('GET /appro/alerts/critical doit retourner les alertes CRITICAL non accusées', async () => {
      const response = await request(app.getHttpServer())
        .get('/appro/alerts/critical')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Toutes les alertes retournées doivent être CRITICAL et non accusées
      response.body.forEach((alert: any) => {
        expect(alert.niveau).toBe('CRITICAL');
        expect(alert.acknowledgedAt).toBeNull();
      });
    });

    it('GET /appro/alerts/counts doit retourner les compteurs', async () => {
      const response = await request(app.getHttpServer())
        .get('/appro/alerts/counts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('critical');
      expect(response.body).toHaveProperty('warning');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('unacknowledged');
      expect(response.body).toHaveProperty('criticalUnacknowledged');
    });

    it('POST /appro/alerts/scan doit scanner et créer les alertes', async () => {
      const response = await request(app.getHttpServer())
        .post('/appro/alerts/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('mpCritiques');
      expect(response.body).toHaveProperty('ruptures');
      expect(response.body).toHaveProperty('fournisseurs');
    });
  });
});
