/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUTH SERVICE TESTS - Authentification & Autorisation
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INVARIANTS TESTES:
 * 1. Login rejette les identifiants invalides
 * 2. Login rejette les utilisateurs inactifs
 * 3. Refresh token rejette les tokens expirés/invalides
 * 4. Création utilisateur rejette les doublons email/code
 * 5. Mot de passe haché (jamais en clair)
 * 6. validateUser rejette les utilisateurs inactifs
 * 7. Changement mot de passe - validations de force
 * 8. Anti-énumération d'email (même message d'erreur)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLogService } from '../security/security-log.service';

describe('AuthService', () => {
  let authService: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    device: {
      upsert: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('7d'),
  };

  const mockSecurityLogService = {
    logLoginFailure: jest.fn().mockResolvedValue(undefined),
    logLoginSuccess: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SecurityLogService, useValue: mockSecurityLogService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  describe('login', () => {
    const validHash = bcrypt.hashSync('MotDePasse1!x', 10);
    const activeUser = {
      id: 'user-1',
      email: 'admin@manchengo.dz',
      passwordHash: validHash,
      isActive: true,
      role: 'ADMIN',
      code: 'ADM001',
      firstName: 'Test',
      lastName: 'Admin',
      mustChangePassword: false,
    };

    it('devrait retourner les tokens et les infos utilisateur avec des identifiants valides', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.login({
        email: 'admin@manchengo.dz',
        password: 'MotDePasse1!x',
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('admin@manchengo.dz');
      expect(result.user.role).toBe('ADMIN');
      expect(result.user.id).toBe('user-1');
      // SECURITE: passwordHash ne doit JAMAIS etre dans la reponse
      expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('devrait rejeter le login quand l\'email n\'existe pas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'inconnu@test.dz', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait rejeter le login pour un utilisateur inactif', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        isActive: false,
      });

      await expect(
        authService.login({ email: 'admin@manchengo.dz', password: 'MotDePasse1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait rejeter le login avec un mot de passe incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      await expect(
        authService.login({ email: 'admin@manchengo.dz', password: 'mauvais-mdp' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait retourner le meme message d\'erreur pour email inconnu et mauvais mot de passe (anti-enumeration)', async () => {
      // Cas 1: email inexistant
      mockPrisma.user.findUnique.mockResolvedValue(null);
      let erreurEmailInconnu: string = '';
      try {
        await authService.login({ email: 'x@test.dz', password: 'y' });
      } catch (e) {
        erreurEmailInconnu = (e as UnauthorizedException).message;
      }

      // Cas 2: email valide, mdp incorrect
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      let erreurMauvaisMdp: string = '';
      try {
        await authService.login({ email: 'admin@manchengo.dz', password: 'wrong' });
      } catch (e) {
        erreurMauvaisMdp = (e as UnauthorizedException).message;
      }

      expect(erreurEmailInconnu).toBe(erreurMauvaisMdp);
      expect(erreurEmailInconnu).toBe('Identifiants invalides');
    });

    it('devrait enregistrer l\'appareil lors d\'un login mobile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.device.upsert.mockResolvedValue({});

      await authService.login({
        email: 'admin@manchengo.dz',
        password: 'MotDePasse1!x',
        deviceId: 'device-123',
        deviceName: 'Samsung Galaxy',
        platform: 'android',
      });

      expect(mockPrisma.device.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'device-123' },
          create: expect.objectContaining({
            id: 'device-123',
            userId: 'user-1',
            platform: 'android',
          }),
        }),
      );
    });

    it('devrait ne pas enregistrer d\'appareil pour un login web (sans deviceId)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockPrisma.refreshToken.create.mockResolvedValue({});

      await authService.login({
        email: 'admin@manchengo.dz',
        password: 'MotDePasse1!x',
      });

      expect(mockPrisma.device.upsert).not.toHaveBeenCalled();
    });

    it('devrait inclure mustChangePassword dans la reponse', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        mustChangePassword: true,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.login({
        email: 'admin@manchengo.dz',
        password: 'MotDePasse1!x',
      });

      expect(result.user.mustChangePassword).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANGEMENT DE MOT DE PASSE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('changePassword', () => {
    const validHash = bcrypt.hashSync('AncienMdp1!x', 10);
    const activeUser = {
      id: 'user-1',
      email: 'user@manchengo.dz',
      passwordHash: validHash,
      isActive: true,
      role: 'ADMIN',
    };

    it('devrait rejeter un mot de passe trop court (moins de 12 caracteres)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      await expect(
        authService.changePassword('user-1', 'AncienMdp1!x', 'Ab1!'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        authService.changePassword('user-1', 'AncienMdp1!x', 'Ab1!'),
      ).rejects.toThrow(/au moins 12 caractères/);
    });

    it('devrait rejeter un mot de passe sans majuscule', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      await expect(
        authService.changePassword('user-1', 'AncienMdp1!x', 'sansmajuscule1!'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        authService.changePassword('user-1', 'AncienMdp1!x', 'sansmajuscule1!'),
      ).rejects.toThrow(/majuscule/);
    });

    it('devrait rejeter un mot de passe sans chiffre', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      await expect(
        authService.changePassword('user-1', 'AncienMdp1!x', 'SansChiffreXx!'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        authService.changePassword('user-1', 'AncienMdp1!x', 'SansChiffreXx!'),
      ).rejects.toThrow(/chiffre/);
    });

    it('devrait rejeter quand le nouveau mot de passe est identique a l\'ancien', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      await expect(
        authService.changePassword('user-1', 'AncienMdp1!x', 'AncienMdp1!x'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        authService.changePassword('user-1', 'AncienMdp1!x', 'AncienMdp1!x'),
      ).rejects.toThrow(/différent de l'ancien/);
    });

    it('devrait rejeter quand le mot de passe actuel est incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);

      await expect(
        authService.changePassword('user-1', 'MauvaisActuel1!', 'NouveauMdp1!x'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        authService.changePassword('user-1', 'MauvaisActuel1!', 'NouveauMdp1!x'),
      ).rejects.toThrow(/Mot de passe actuel incorrect/);
    });

    it('devrait rejeter le changement pour un utilisateur inactif', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...activeUser,
        isActive: false,
      });

      await expect(
        authService.changePassword('user-1', 'AncienMdp1!x', 'NouveauMdp1!x'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait changer le mot de passe avec succes et mettre mustChangePassword a false', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await authService.changePassword('user-1', 'AncienMdp1!x', 'NouveauMdp1!x');

      expect(result.success).toBe(true);
      expect(result.message).toContain('succès');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            mustChangePassword: false,
          }),
        }),
      );
    });

    it('devrait hasher le nouveau mot de passe avant stockage', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(activeUser);
      mockPrisma.user.update.mockResolvedValue({});

      await authService.changePassword('user-1', 'AncienMdp1!x', 'NouveauMdp1!x');

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.passwordHash).toMatch(/^\$2b\$12\$/);
      expect(updateCall.data.passwordHash).not.toBe('NouveauMdp1!x');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REFRESH TOKEN
  // ═══════════════════════════════════════════════════════════════════════════

  describe('refreshToken', () => {
    it('devrait rejeter un token de rafraichissement invalide', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        authService.refreshToken({ refreshToken: 'token-invalide' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait rejeter un token de rafraichissement expire', async () => {
      const datePassee = new Date();
      datePassee.setDate(datePassee.getDate() - 1);

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'token-expire',
        expiresAt: datePassee,
        user: { id: 'user-1', email: 'a@b.dz', isActive: true, role: 'ADMIN' },
      });

      await expect(
        authService.refreshToken({ refreshToken: 'token-expire' }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        authService.refreshToken({ refreshToken: 'token-expire' }),
      ).rejects.toThrow(/invalide/);
    });

    it('devrait rejeter un refresh token pour un utilisateur inactif', async () => {
      const dateFuture = new Date();
      dateFuture.setDate(dateFuture.getDate() + 7);

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'token-valide',
        expiresAt: dateFuture,
        user: { id: 'user-1', email: 'a@b.dz', isActive: false, role: 'ADMIN' },
      });

      await expect(
        authService.refreshToken({ refreshToken: 'token-valide' }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        authService.refreshToken({ refreshToken: 'token-valide' }),
      ).rejects.toThrow(/désactivé/);
    });

    it('devrait supprimer l\'ancien token et generer une nouvelle paire', async () => {
      const dateFuture = new Date();
      dateFuture.setDate(dateFuture.getDate() + 7);

      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        token: 'token-valide',
        deviceId: null,
        expiresAt: dateFuture,
        user: { id: 'user-1', email: 'a@b.dz', isActive: true, role: 'ADMIN' },
      });
      mockPrisma.refreshToken.delete.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.refreshToken({ refreshToken: 'token-valide' });

      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATION UTILISATEUR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createUser', () => {
    it('devrait rejeter un email ou code duplique', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'existant' });

      await expect(
        authService.createUser({
          code: 'NEW001',
          email: 'existant@test.dz',
          password: 'MotDePasse1!x',
          firstName: 'Nouveau',
          lastName: 'Utilisateur',
          role: 'COMMERCIAL' as any,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('devrait rejeter un mot de passe faible a la creation (validation de force)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      // Mot de passe trop court
      await expect(
        authService.createUser({
          code: 'NEW001',
          email: 'new@test.dz',
          password: 'Ab1',
          firstName: 'Nouveau',
          lastName: 'Utilisateur',
          role: 'COMMERCIAL' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait hasher le mot de passe avant stockage', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockImplementation(async ({ data }: any) => {
        expect(data.passwordHash).toMatch(/^\$2b\$12\$/);
        expect(data.passwordHash).not.toBe('MotDePasse1!x');
        return { id: 'new-id', code: data.code, email: data.email };
      });

      await authService.createUser({
        code: 'NEW001',
        email: 'new@test.dz',
        password: 'MotDePasse1!x',
        firstName: 'Nouveau',
        lastName: 'Utilisateur',
        role: 'APPRO' as any,
      });

      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('devrait retourner id, code et email apres creation reussie', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-id',
        code: 'NEW001',
        email: 'new@test.dz',
      });

      const result = await authService.createUser({
        code: 'NEW001',
        email: 'new@test.dz',
        password: 'MotDePasse1!x',
        firstName: 'Nouveau',
        lastName: 'Utilisateur',
        role: 'COMMERCIAL' as any,
      });

      expect(result.id).toBe('new-id');
      expect(result.code).toBe('NEW001');
      expect(result.email).toBe('new@test.dz');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION UTILISATEUR (depuis JWT payload)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('validateUser', () => {
    it('devrait rejeter un utilisateur inexistant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.validateUser({ sub: 'inexistant', email: 'a@b.dz', role: 'ADMIN' as any }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait rejeter un utilisateur inactif', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
      });

      await expect(
        authService.validateUser({ sub: 'user-1', email: 'a@b.dz', role: 'ADMIN' as any }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait retourner l\'utilisateur pour un token JWT actif valide', async () => {
      const utilisateurActif = { id: 'user-1', email: 'a@b.dz', isActive: true, role: 'ADMIN' };
      mockPrisma.user.findUnique.mockResolvedValue(utilisateurActif);

      const result = await authService.validateUser({
        sub: 'user-1',
        email: 'a@b.dz',
        role: 'ADMIN' as any,
      });

      expect(result.id).toBe('user-1');
      expect(result.isActive).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DECONNEXION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('logout', () => {
    it('devrait supprimer le refresh token lors de la deconnexion', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await authService.logout('un-refresh-token');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'un-refresh-token' },
      });
    });
  });
});
