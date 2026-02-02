/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STOCK SERVICE TESTS - Regles metier de gestion de stock
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INVARIANTS TESTES:
 * 1. Stock ne peut pas devenir negatif
 * 2. Combinaisons mouvement appliquees (MP pas vendable, PF pas achetable)
 * 3. Controle d'acces base sur les roles
 * 4. Quantite strictement positive
 * 5. Mouvement OUT necessite stock suffisant
 * 6. Calcul correct du statut stock
 * 7. Mouvement IN cree correctement
 * 8. Mouvement OUT avec stock exact
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StockService } from './stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CacheService } from '../cache/cache.service';

describe('StockService - Invariants metier', () => {
  let service: StockService;

  const mockPrisma: any = {
    stockMovement: {
      groupBy: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    productMp: { findMany: jest.fn() },
    productPf: { findMany: jest.fn() },
    receptionMp: { count: jest.fn(), create: jest.fn() },
    recipeItem: { groupBy: jest.fn() },
    lotMp: { update: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    lotPf: { update: jest.fn(), groupBy: jest.fn() },
    $transaction: jest.fn((fn: any) => {
      if (typeof fn === 'function') return fn(mockPrisma);
      return Promise.all(fn);
    }),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockCacheService = {
    getOrSet: jest.fn((key: string, fn: () => any) => fn()),
    buildStockKey: jest.fn((type: string) => `stock:${type}`),
    invalidateStockCache: jest.fn().mockResolvedValue(undefined),
    invalidateProductionCache: jest.fn().mockResolvedValue(undefined),
    invalidateSalesCache: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBINAISONS MOUVEMENT METIER
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Validation des combinaisons mouvement', () => {
    it('devrait interdire la vente de Matieres Premieres (MP + VENTE)', () => {
      expect(() => {
        service.validateMovementCombination('MP', 'VENTE', 'OUT');
      }).toThrow(BadRequestException);
      expect(() => {
        service.validateMovementCombination('MP', 'VENTE', 'OUT');
      }).toThrow(/ne peuvent pas avoir de mouvement VENTE/);
    });

    it('devrait interdire la reception de Produits Finis (PF + RECEPTION)', () => {
      expect(() => {
        service.validateMovementCombination('PF', 'RECEPTION', 'IN');
      }).toThrow(BadRequestException);
      expect(() => {
        service.validateMovementCombination('PF', 'RECEPTION', 'IN');
      }).toThrow(/ne peuvent pas avoir de mouvement RECEPTION/);
    });

    it('devrait interdire PRODUCTION_IN pour les MP', () => {
      expect(() => {
        service.validateMovementCombination('MP', 'PRODUCTION_IN', 'IN');
      }).toThrow(BadRequestException);
    });

    it('devrait interdire PRODUCTION_OUT pour les PF', () => {
      expect(() => {
        service.validateMovementCombination('PF', 'PRODUCTION_OUT', 'OUT');
      }).toThrow(BadRequestException);
    });

    it('devrait autoriser MP + RECEPTION + IN', () => {
      expect(() => {
        service.validateMovementCombination('MP', 'RECEPTION', 'IN');
      }).not.toThrow();
    });

    it('devrait autoriser PF + PRODUCTION_IN + IN', () => {
      expect(() => {
        service.validateMovementCombination('PF', 'PRODUCTION_IN', 'IN');
      }).not.toThrow();
    });

    it('devrait autoriser PF + VENTE + OUT', () => {
      expect(() => {
        service.validateMovementCombination('PF', 'VENTE', 'OUT');
      }).not.toThrow();
    });

    it('devrait autoriser INVENTAIRE pour IN et OUT (ajustement)', () => {
      expect(() => service.validateMovementCombination('MP', 'INVENTAIRE', 'IN')).not.toThrow();
      expect(() => service.validateMovementCombination('MP', 'INVENTAIRE', 'OUT')).not.toThrow();
      expect(() => service.validateMovementCombination('PF', 'INVENTAIRE', 'IN')).not.toThrow();
      expect(() => service.validateMovementCombination('PF', 'INVENTAIRE', 'OUT')).not.toThrow();
    });

    it('devrait rejeter un type de mouvement incorrect pour l\'origine', () => {
      // RECEPTION doit etre IN, pas OUT
      expect(() => {
        service.validateMovementCombination('MP', 'RECEPTION', 'OUT');
      }).toThrow(BadRequestException);
      expect(() => {
        service.validateMovementCombination('MP', 'RECEPTION', 'OUT');
      }).toThrow(/doit être IN/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROLE D'ACCES PAR ROLE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Controle d\'acces par role', () => {
    it('devrait interdire COMMERCIAL de faire une RECEPTION', () => {
      expect(() => {
        service.validateRoleForOrigin('RECEPTION', 'COMMERCIAL');
      }).toThrow(ForbiddenException);
    });

    it('devrait interdire PRODUCTION de faire une VENTE', () => {
      expect(() => {
        service.validateRoleForOrigin('VENTE', 'PRODUCTION');
      }).toThrow(ForbiddenException);
    });

    it('devrait interdire les non-ADMIN de faire un INVENTAIRE', () => {
      expect(() => service.validateRoleForOrigin('INVENTAIRE', 'APPRO')).toThrow(ForbiddenException);
      expect(() => service.validateRoleForOrigin('INVENTAIRE', 'PRODUCTION')).toThrow(ForbiddenException);
      expect(() => service.validateRoleForOrigin('INVENTAIRE', 'COMMERCIAL')).toThrow(ForbiddenException);
    });

    it('devrait autoriser ADMIN pour toutes les origines', () => {
      const origines = [
        'RECEPTION', 'PRODUCTION_IN', 'PRODUCTION_OUT',
        'VENTE', 'INVENTAIRE', 'RETOUR_CLIENT', 'PERTE',
      ] as const;

      for (const origin of origines) {
        expect(() => service.validateRoleForOrigin(origin, 'ADMIN')).not.toThrow();
      }
    });

    it('devrait autoriser APPRO pour RECEPTION', () => {
      expect(() => service.validateRoleForOrigin('RECEPTION', 'APPRO')).not.toThrow();
    });

    it('devrait autoriser PRODUCTION pour PRODUCTION_OUT', () => {
      expect(() => service.validateRoleForOrigin('PRODUCTION_OUT', 'PRODUCTION')).not.toThrow();
    });

    it('devrait autoriser COMMERCIAL pour VENTE', () => {
      expect(() => service.validateRoleForOrigin('VENTE', 'COMMERCIAL')).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATION DE MOUVEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Creation de mouvement', () => {
    it('devrait creer un mouvement IN valide et mettre a jour le stock', async () => {
      // Stock actuel = 0
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 1,
        movementType: 'IN',
        productType: 'MP',
        origin: 'RECEPTION',
        quantity: 100,
      });

      const movement = await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'RECEPTION',
          movementType: 'IN',
          quantity: 100,
          unitCost: 5000,
          reference: 'REC-001',
        },
        'user-1',
        'APPRO' as any,
      );

      expect(movement.movementType).toBe('IN');
      expect(movement.quantity).toBe(100);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('devrait creer un mouvement OUT valide quand le stock est suffisant', async () => {
      // Stock actuel = 100 (groupBy returns IN: 100)
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 100 } },
      ]);
      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 2,
        movementType: 'OUT',
        productType: 'MP',
        origin: 'PRODUCTION_OUT',
        quantity: 50,
      });

      const movement = await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'PRODUCTION_OUT',
          movementType: 'OUT',
          quantity: 50,
        },
        'user-1',
        'PRODUCTION' as any,
      );

      expect(movement.movementType).toBe('OUT');
      expect(movement.quantity).toBe(50);
    });

    it('devrait rejeter un mouvement OUT quand le stock est insuffisant', async () => {
      // Stock actuel = 30
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 30 } },
      ]);

      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'PRODUCTION_OUT',
            movementType: 'OUT',
            quantity: 100,
          },
          'user-1',
          'PRODUCTION' as any,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'PRODUCTION_OUT',
            movementType: 'OUT',
            quantity: 100,
          },
          'user-1',
          'PRODUCTION' as any,
        ),
      ).rejects.toThrow(/Stock insuffisant/);
    });

    it('devrait rejeter une quantite nulle', async () => {
      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'RECEPTION',
            movementType: 'IN',
            quantity: 0,
          },
          'user-1',
          'APPRO' as any,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'RECEPTION',
            movementType: 'IN',
            quantity: 0,
          },
          'user-1',
          'APPRO' as any,
        ),
      ).rejects.toThrow(/strictement positive/);
    });

    it('devrait rejeter une quantite negative', async () => {
      await expect(
        service.createMovement(
          {
            productType: 'MP',
            productId: 1,
            origin: 'RECEPTION',
            movementType: 'IN',
            quantity: -10,
          },
          'user-1',
          'APPRO' as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCUL DE STOCK
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Calcul de stock', () => {
    it('devrait calculer stock = IN - OUT correctement', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 150 } },
        { movementType: 'OUT', _sum: { quantity: 30 } },
      ]);

      const stock = await service.calculateStock('MP', 1);
      expect(stock).toBe(120);
    });

    it('devrait retourner 0 quand aucun mouvement', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);

      const stock = await service.calculateStock('MP', 1);
      expect(stock).toBe(0);
    });

    it('devrait retourner le total IN quand aucun OUT', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([
        { movementType: 'IN', _sum: { quantity: 200 } },
      ]);

      const stock = await service.calculateStock('MP', 1);
      expect(stock).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUT DE STOCK
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Statut de stock', () => {
    it('devrait retourner RUPTURE quand le stock est 0', () => {
      expect(service.getStockStatus(0, 100)).toBe('RUPTURE');
    });

    it('devrait retourner ALERTE quand le stock <= minStock', () => {
      expect(service.getStockStatus(50, 100)).toBe('ALERTE');
      expect(service.getStockStatus(100, 100)).toBe('ALERTE');
    });

    it('devrait retourner OK quand le stock > minStock', () => {
      expect(service.getStockStatus(101, 100)).toBe('OK');
      expect(service.getStockStatus(200, 100)).toBe('OK');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Audit des mouvements', () => {
    it('devrait enregistrer un audit log avec severite CRITICAL pour INVENTAIRE', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 1,
        movementType: 'IN',
        productType: 'MP',
        origin: 'INVENTAIRE',
        quantity: 10,
      });

      await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'INVENTAIRE',
          movementType: 'IN',
          quantity: 10,
        },
        'admin-1',
        'ADMIN' as any,
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'CRITICAL',
          action: 'STOCK_MOVEMENT_CREATED',
        }),
      );
    });

    it('devrait enregistrer un audit log avec severite INFO pour RECEPTION', async () => {
      mockPrisma.stockMovement.groupBy.mockResolvedValue([]);
      mockPrisma.stockMovement.create.mockResolvedValue({
        id: 1,
        movementType: 'IN',
        productType: 'MP',
        origin: 'RECEPTION',
        quantity: 100,
      });

      await service.createMovement(
        {
          productType: 'MP',
          productId: 1,
          origin: 'RECEPTION',
          movementType: 'IN',
          quantity: 100,
        },
        'user-1',
        'APPRO' as any,
      );

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'INFO',
        }),
      );
    });
  });
});
